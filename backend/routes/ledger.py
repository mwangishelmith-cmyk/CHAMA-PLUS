import json
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from uuid import uuid4

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from extensions import db
from models import AuditTrail, ChamaAccount, LedgerEntry, MemberProfile, User, Chama


ledger_bp = Blueprint("ledger", __name__, url_prefix="/api/v1")

CENT = Decimal("0.01")
TREASURER_ROLE = "Treasurer"
CHAIRPERSON_ROLE = "Chairperson"

ALLOWED_ACCOUNT_TYPES = {
    "BANK",
    "MOBILE_MONEY",
    "CASH",
    "OTHER",
}

class ValidationError(Exception):
    pass


def _utc_now():
    return datetime.utcnow()


def _decimal_from_db(value):
    if value in (None, ""):
        return Decimal("0.00")
    if isinstance(value, Decimal):
        return value.quantize(CENT)
    return Decimal(str(value)).quantize(CENT)


def _decimal_to_str(value):
    return str(_decimal_from_db(value))


def _parse_amount(value, *, field_name="amount", allow_negative=False):
    if value in (None, ""):
        raise ValidationError(f"{field_name} is required")

    try:
        amount = Decimal(str(value)).quantize(CENT)
    except (InvalidOperation, ValueError):
        raise ValidationError(f"{field_name} must be a valid decimal number") from None

    if amount == Decimal("0.00"):
        raise ValidationError(f"{field_name} must be non-zero")

    if not allow_negative and amount < Decimal("0.00"):
        raise ValidationError(f"{field_name} must be greater than zero")

    return amount


def _parse_optional_datetime(value, *, field_name):
    if value in (None, ""):
        return None

    if isinstance(value, datetime):
        return value

    if not isinstance(value, str):
        raise ValidationError(f"{field_name} must be an ISO datetime string")

    normalized = value.strip()
    if not normalized:
        return None

    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"

    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        raise ValidationError(f"{field_name} must be a valid ISO datetime") from None


def _json_safe(value):
    if isinstance(value, Decimal):
        return _decimal_to_str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    return value


def _current_user():
    identity = get_jwt_identity()
    if not identity:
        return None
    return db.session.get(User, str(identity))


def _membership_for_user(user_id, chama_id, *, active_only=True):
    stmt = select(MemberProfile).where(
        MemberProfile.user_id == user_id,
        MemberProfile.chama_id == chama_id,
    )
    if active_only:
        stmt = stmt.where(MemberProfile.is_active.is_(True))
    return db.session.execute(stmt).scalar_one_or_none()


def _member_profile(member_id, chama_id):
    stmt = select(MemberProfile).where(
        MemberProfile.id == member_id,
        MemberProfile.chama_id == chama_id,
    )
    return db.session.execute(stmt).scalar_one_or_none()


def _authorize_for_chama(*, allowed_roles=None):
    user = _current_user()
    if user is None:
        return None, None, (jsonify({"message": "Unauthorized"}), 401)

    chama_id = request.view_args.get("chama_id")
    membership = _membership_for_user(user.id, chama_id, active_only=True)
    if membership is None:
        return user, None, (jsonify({"message": "Access denied: chama membership required"}), 403)

    if allowed_roles and membership.role not in allowed_roles:
        return user, membership, (jsonify({"message": "Access denied: insufficient permissions"}), 403)

    return user, membership, None


def _primary_account(chama_id):
    stmt = (
        select(ChamaAccount)
        .where(
            ChamaAccount.chama_id == chama_id,
            ChamaAccount.is_primary.is_(True),
            ChamaAccount.is_active.is_(True),
        )
    )

    return db.session.execute(stmt).scalar_one_or_none()


def _create_audit_trail(*, actor_user, chama_id, member_id, actor_role, action, record_id, old_data=None, new_data=None, change_summary=None):
    entry = AuditTrail(
        user_id=actor_user.id,
        chama_id=chama_id,
        member_id=member_id,
        role=actor_role,
        action=action,
        table_name="ledger_entries",
        record_id=record_id,
        old_data=json.dumps(_json_safe(old_data), ensure_ascii=False) if old_data is not None else None,
        new_data=json.dumps(_json_safe(new_data), ensure_ascii=False) if new_data is not None else None,
        change_summary=change_summary,
    )
    db.session.add(entry)


def _debt_entry_outstanding(entry):
    amount = _decimal_from_db(entry.amount)
    fine = _decimal_from_db(entry.fine_amount)
    return (amount + fine).quantize(CENT)


def _debt_delta(entry):
    amount = _decimal_from_db(entry.amount)
    fine = _decimal_from_db(entry.fine_amount)

    if entry.transaction_type in {"CONTRIBUTION", "FINE"}:
        return (amount + fine).quantize(CENT)

    if entry.transaction_type == "PAYMENT":
        return (-amount).quantize(CENT)

    if entry.transaction_type == "ADJUSTMENT":
        return (-amount).quantize(CENT)

    return Decimal("0.00")


def _entry_effective_timestamp(entry):
    return entry.transaction_date or entry.created_at


def _statement_aggregates(entries):
    outstanding_debt = Decimal("0.00")
    total_payments = Decimal("0.00")
    total_fines = Decimal("0.00")

    for entry in entries:
        if not entry.is_paid:
            outstanding_debt += _debt_entry_outstanding(entry)

        if entry.transaction_type == "PAYMENT":
            total_payments += _decimal_from_db(entry.amount)
        elif entry.transaction_type == "FINE":
            total_fines += _decimal_from_db(entry.fine_amount)

    return {
        "outstanding_debt": outstanding_debt.quantize(CENT),
        "total_payments": total_payments.quantize(CENT),
        "total_fines": total_fines.quantize(CENT),
    }


def cron_apply_overdue_fines():
    """Apply configured late fines for overdue unpaid contributions."""
    now = _utc_now()

    stmt = (
        select(LedgerEntry, Chama)
        .join(Chama, Chama.id == LedgerEntry.chama_id)
        .where(
            LedgerEntry.transaction_type == "CONTRIBUTION",
            LedgerEntry.is_paid.is_(False),
            LedgerEntry.due_date.is_not(None),
            Chama.late_fine_amount.is_not(None),
        )
        .order_by(LedgerEntry.due_date.asc(), LedgerEntry.created_at.asc())
    )
    overdue_rows = db.session.execute(stmt).all()

    applied_count = 0

    try:
        for contribution_entry, chama in overdue_rows:
            due_date = contribution_entry.due_date
            grace_days = chama.late_fine_days_grace or 0

            if due_date is None or now <= due_date + timedelta(days=grace_days):
                continue

            auto_transaction_id = f"AUTO_FINE_{contribution_entry.id}"
            existing_auto_fine = db.session.execute(
                select(LedgerEntry.id).where(LedgerEntry.transaction_id == auto_transaction_id)
            ).scalar_one_or_none()
            if existing_auto_fine is not None:
                continue

            actor_user = contribution_entry.member.user if contribution_entry.member and contribution_entry.member.user else None
            if actor_user is None:
                continue

            fine_entry = LedgerEntry(
                transaction_id=auto_transaction_id,
                chama_id=contribution_entry.chama_id,
                member_id=contribution_entry.member_id,
                chama_account_id=contribution_entry.chama_account_id,
                transaction_type="FINE",
                transaction_subtype="AUTO_OVERDUE_FINE",
                amount=Decimal("0.00"),
                fine_amount=_decimal_from_db(chama.late_fine_amount),
                reference=contribution_entry.reference,
                transaction_date=now,
                due_date=None,
                is_paid=False,
                status="UNPAID",
                notes=f"Auto-applied fine for overdue contribution {contribution_entry.id}",
            )

            db.session.add(fine_entry)
            db.session.flush()

            _create_audit_trail(
                actor_user=actor_user,
                chama_id=contribution_entry.chama_id,
                member_id=contribution_entry.member_id,
                actor_role=contribution_entry.member.role if contribution_entry.member else None,
                action="AUTO_APPLY_FINE",
                record_id=fine_entry.id,
                old_data=None,
                new_data={
                    "source_contribution_id": contribution_entry.id,
                    "fine_entry": fine_entry.to_dict(),
                    "late_fine_amount": _decimal_to_str(chama.late_fine_amount),
                    "late_fine_days_grace": grace_days,
                },
                change_summary="Automated overdue fine applied by scheduler",
            )
            applied_count += 1

        if applied_count:
            db.session.commit()
        else:
            db.session.rollback()

        return applied_count

    except SQLAlchemyError:
        db.session.rollback()
        raise

def _parse_account_type(value):
    """Validate and parse account type against allowed values."""
    if value in (None, ""):
        raise ValidationError("account_type is required")
    
    account_type = value.strip().upper()
    if account_type not in ALLOWED_ACCOUNT_TYPES:
        raise ValidationError(f"account_type must be one of: {', '.join(ALLOWED_ACCOUNT_TYPES)}")
    
    return account_type


def _parse_boolean(value, *, field_name):
    """Parse boolean values from various input formats."""
    if value in (None, ""):
        return False
    
    if isinstance(value, bool):
        return value
    
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "yes", "1"}:
            return True
        if normalized in {"false", "no", "0"}:
            return False
        raise ValidationError(f"{field_name} must be a boolean value")
    
    if isinstance(value, (int, float)):
        return bool(value)
    
    raise ValidationError(f"{field_name} must be a boolean value")

@ledger_bp.route("/chamas/<chama_id>/ledger/contribution", methods=["POST"])
@jwt_required()
def add_contribution(chama_id):
    actor_user, actor_membership, error_response = _authorize_for_chama(allowed_roles={TREASURER_ROLE})
    if error_response:
        return error_response

    payload = request.get_json(silent=True) or {}
    member_id = (payload.get("member_id") or "").strip()
    transaction_subtype = (payload.get("transaction_subtype") or "").strip() or None
    reference = (payload.get("reference") or "").strip() or None

    if not member_id:
        return jsonify({"message": "member_id is required"}), 400

    try:
        amount = _parse_amount(payload.get("amount"), field_name="amount", allow_negative=False)
        due_date = _parse_optional_datetime(payload.get("due_date"), field_name="due_date")
    except ValidationError as exc:
        return jsonify({"message": str(exc)}), 400

    member = _member_profile(member_id, chama_id)
    if member is None:
        return jsonify({"message": "Member not found in this chama"}), 404

    account = _primary_account(chama_id)
    if account is None:
        return jsonify({"message": "No primary chama account found for this chama"}), 400

    previous_balance = _decimal_from_db(account.current_balance)

    try:
        ledger_entry = LedgerEntry(
            transaction_id=str(uuid4()),
            chama_id=chama_id,
            member_id=member.id,
            chama_account_id=account.id,
            transaction_type="CONTRIBUTION",
            transaction_subtype=transaction_subtype,
            amount=amount,
            fine_amount=Decimal("0.00"),
            reference=reference,
            transaction_date=_utc_now(),
            due_date=due_date,
            is_paid=False,
            status="PENDING",
        )

        db.session.add(ledger_entry)
        db.session.flush()

        account.current_balance = (previous_balance + amount).quantize(CENT)

        _create_audit_trail(
            actor_user=actor_user,
            chama_id=chama_id,
            member_id=member.id,
            actor_role=actor_membership.role,
            action="ADD_CONTRIBUTION",
            record_id=ledger_entry.id,
            old_data=None,
            new_data={
                "ledger_entry": ledger_entry.to_dict(),
                "previous_balance": _decimal_to_str(previous_balance),
                "new_balance": _decimal_to_str(account.current_balance),
            },
            change_summary="Contribution recorded and chama balance updated",
        )

        db.session.commit()

        return (
            jsonify(
                {
                    "ledger_entry_id": ledger_entry.id,
                    "previous_balance": _decimal_to_str(previous_balance),
                    "new_balance": _decimal_to_str(account.current_balance),
                }
            ),
            201,
        )

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Could not record contribution"}), 500

@ledger_bp.route("/chamas/<chama_id>/accounts", methods=["POST"])
@jwt_required()
def add_chama_account(chama_id):
    """Add a new bank account to a chama. Only Treasurers can perform this action."""
    actor_user, actor_membership, error_response = _authorize_for_chama(allowed_roles={TREASURER_ROLE})
    if error_response:
        return error_response

    payload = request.get_json(silent=True) or {}
    
    # Extract and validate required fields
    account_name = (payload.get("account_name") or "").strip()
    institution_name = (payload.get("institution_name") or "").strip()
    account_type = (payload.get("account_type") or "").strip()
    is_primary = _parse_boolean(payload.get("is_primary"), field_name="is_primary")
    opening_balance = Decimal("0.00")

    if not account_name:
        return jsonify({"message": "account_name is required"}), 400
    
    if not institution_name:
        return jsonify({"message": "institution_name is required"}), 400
    
    raw_balance = payload.get("opening_balance", "0.00")
    if raw_balance in (None, ""):
        opening_balance = Decimal("0.00")
    else:
        try:
            opening_balance = Decimal(str(raw_balance)).quantize(CENT)
            if opening_balance < Decimal("0.00"):
                return jsonify({"message": "opening_balance must not be negative"}), 400
        except (InvalidOperation, ValueError):
            return jsonify({"message": "opening_balance must be a valid decimal number"}), 400

    # Verify chama exists
    chama = db.session.get(Chama, chama_id)
    if chama is None:
        return jsonify({"message": "Chama not found"}), 404

    try:
        # Handle primary account logic - if new account is primary, unset any existing primary
        if is_primary:
            existing_primary = db.session.execute(
                select(ChamaAccount).where(
                    ChamaAccount.chama_id == chama_id,
                    ChamaAccount.is_primary.is_(True),
                    ChamaAccount.is_active.is_(True)
                )
            ).scalar_one_or_none()
            
            if existing_primary:
                existing_primary.is_primary = False
                # Track old data for audit
                old_data = existing_primary.to_dict()
                db.session.flush()
                # Create audit entry for the update
                _create_audit_trail(
                    actor_user=actor_user,
                    chama_id=chama_id,
                    member_id=actor_membership.id,
                    actor_role=actor_membership.role,
                    action="UPDATE_ACCOUNT",
                    record_id=existing_primary.id,
                    old_data=old_data,
                    new_data=existing_primary.to_dict(),
                    change_summary=f"Primary status removed from account {existing_primary.account_name} due to new primary account creation",
                )

        # Create the new account
        new_account = ChamaAccount(
            chama_id=chama_id,
            account_name=account_name,
            institution_name=institution_name,
            account_type=account_type,
            account_number=(payload.get("account_number") or "").strip() or None,
            opening_balance=opening_balance,
            current_balance=opening_balance,  # Current balance starts at opening balance
            is_active=True,
            is_primary=is_primary,
            reconciliation_status="PENDING",  # Default status for new accounts
        )

        db.session.add(new_account)
        db.session.flush()

        # Create audit trail for the new account
        _create_audit_trail(
            actor_user=actor_user,
            chama_id=chama_id,
            member_id=actor_membership.id,
            actor_role=actor_membership.role,
            action="CREATE_ACCOUNT",
            record_id=new_account.id,
            old_data=None,
            new_data=new_account.to_dict(),
            change_summary=f"New {account_type} account created: {account_name}",
        )

        db.session.commit()

        return (
            jsonify(
                {
                    "account_id": new_account.id,
                    "account_name": new_account.account_name,
                    "account_type": new_account.account_type,
                    "institution_name": new_account.institution_name,
                    "opening_balance": _decimal_to_str(new_account.opening_balance),
                    "current_balance": _decimal_to_str(new_account.current_balance),
                    "is_primary": new_account.is_primary,
                    "is_active": new_account.is_active,
                    "created_at": new_account.created_at.isoformat() if new_account.created_at else None,
                }
            ),
            201,
        )

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Could not create account"}), 500

@ledger_bp.route("/chamas/<chama_id>/ledger/payment", methods=["POST"])
@jwt_required()
def add_payment(chama_id):
    actor_user, actor_membership, error_response = _authorize_for_chama(allowed_roles={TREASURER_ROLE})
    if error_response:
        return error_response

    payload = request.get_json(silent=True) or {}
    member_id = (payload.get("member_id") or "").strip()
    reference = (payload.get("reference") or "").strip() or None
    payment_method = (payload.get("payment_method") or "").strip() or None

    if not member_id:
        return jsonify({"message": "member_id is required"}), 400

    try:
        payment_amount = _parse_amount(payload.get("amount"), field_name="amount", allow_negative=False)
    except ValidationError as exc:
        return jsonify({"message": str(exc)}), 400

    member = _member_profile(member_id, chama_id)
    if member is None:
        return jsonify({"message": "Member not found in this chama"}), 404

    account = _primary_account(chama_id)
    if account is None:
        return jsonify({"message": "No primary chama account found for this chama"}), 400

    stmt = (
        select(LedgerEntry)
        .where(
            LedgerEntry.chama_id == chama_id,
            LedgerEntry.member_id == member.id,
            LedgerEntry.is_paid.is_(False),
        )
        .order_by(
            func.coalesce(LedgerEntry.due_date, LedgerEntry.created_at).asc(),
            LedgerEntry.created_at.asc(),
        )
    )
    outstanding_entries = db.session.execute(stmt).scalars().all()

    if not outstanding_entries:
        return jsonify({"message": "No outstanding debt entries found for this member"}), 400

    total_outstanding = Decimal("0.00")
    for entry in outstanding_entries:
        total_outstanding += _debt_entry_outstanding(entry)

    total_outstanding = total_outstanding.quantize(CENT)
    if payment_amount > total_outstanding:
        return (
            jsonify(
                {
                    "message": "Payment amount exceeds outstanding debt",
                    "outstanding_debt": _decimal_to_str(total_outstanding),
                }
            ),
            400,
        )

    previous_balance = _decimal_from_db(account.current_balance)

    try:
        remaining = payment_amount
        linked_entry_id = None
        resolved_entry_ids = []

        for debt_entry in outstanding_entries:
            if remaining <= Decimal("0.00"):
                break

            outstanding = _debt_entry_outstanding(debt_entry)
            if outstanding <= Decimal("0.00"):
                debt_entry.is_paid = True
                debt_entry.status = "PAID"
                continue

            if linked_entry_id is None:
                linked_entry_id = debt_entry.id

            applied = min(remaining, outstanding)
            remaining = (remaining - applied).quantize(CENT)

            remaining_fine = _decimal_from_db(debt_entry.fine_amount)
            remaining_amount = _decimal_from_db(debt_entry.amount)

            if remaining_fine > Decimal("0.00"):
                fine_applied = min(applied, remaining_fine)
                remaining_fine = (remaining_fine - fine_applied).quantize(CENT)
                applied = (applied - fine_applied).quantize(CENT)

            if applied > Decimal("0.00"):
                remaining_amount = (remaining_amount - applied).quantize(CENT)

            debt_entry.fine_amount = remaining_fine
            debt_entry.amount = remaining_amount

            unresolved = (remaining_amount + remaining_fine).quantize(CENT)
            if unresolved <= Decimal("0.00"):
                debt_entry.is_paid = True
                debt_entry.status = "PAID"
                resolved_entry_ids.append(debt_entry.id)
            else:
                debt_entry.is_paid = False
                debt_entry.status = "PARTIAL"

        applied_total = (payment_amount - remaining).quantize(CENT)

        payment_entry = LedgerEntry(
            transaction_id=linked_entry_id,
            chama_id=chama_id,
            member_id=member.id,
            chama_account_id=account.id,
            transaction_type="PAYMENT",
            transaction_subtype=payment_method,
            amount=applied_total,
            fine_amount=Decimal("0.00"),
            reference=reference,
            transaction_date=_utc_now(),
            due_date=None,
            is_paid=True,
            status="PAID",
            notes=(
                "Applied to debt entries: " + ", ".join(resolved_entry_ids)
                if resolved_entry_ids
                else "Applied as partial settlement"
            ),
        )

        db.session.add(payment_entry)
        db.session.flush()

        account.current_balance = (previous_balance - applied_total).quantize(CENT)

        _create_audit_trail(
            actor_user=actor_user,
            chama_id=chama_id,
            member_id=member.id,
            actor_role=actor_membership.role,
            action="ADD_PAYMENT",
            record_id=payment_entry.id,
            old_data=None,
            new_data={
                "payment_entry": payment_entry.to_dict(),
                "settled_entries": resolved_entry_ids,
                "previous_balance": _decimal_to_str(previous_balance),
                "new_balance": _decimal_to_str(account.current_balance),
            },
            change_summary="Payment recorded, debt reduced, and chama balance updated",
        )

        db.session.commit()

        return (
            jsonify(
                {
                    "ledger_entry_id": payment_entry.id,
                    "previous_balance": _decimal_to_str(previous_balance),
                    "new_balance": _decimal_to_str(account.current_balance),
                }
            ),
            201,
        )

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Could not record payment"}), 500


@ledger_bp.route("/chamas/<chama_id>/ledger/fine", methods=["POST"])
@jwt_required()
def apply_fine(chama_id):
    actor_user, actor_membership, error_response = _authorize_for_chama(allowed_roles={TREASURER_ROLE})
    if error_response:
        return error_response

    payload = request.get_json(silent=True) or {}
    member_id = (payload.get("member_id") or "").strip()
    fine_type = (payload.get("fine_type") or "").strip() or None

    if not member_id:
        return jsonify({"message": "member_id is required"}), 400

    try:
        fine_amount = _parse_amount(payload.get("amount"), field_name="amount", allow_negative=False)
        due_date = _parse_optional_datetime(payload.get("due_date"), field_name="due_date")
    except ValidationError as exc:
        return jsonify({"message": str(exc)}), 400

    member = _member_profile(member_id, chama_id)
    if member is None:
        return jsonify({"message": "Member not found in this chama"}), 404

    account = _primary_account(chama_id)
    previous_balance = _decimal_from_db(account.current_balance) if account is not None else Decimal("0.00")

    try:
        ledger_entry = LedgerEntry(
            transaction_id=str(uuid4()),
            chama_id=chama_id,
            member_id=member.id,
            chama_account_id=account.id if account else None,
            transaction_type="FINE",
            transaction_subtype=fine_type,
            amount=Decimal("0.00"),
            fine_amount=fine_amount,
            reference=None,
            transaction_date=_utc_now(),
            due_date=due_date,
            is_paid=False,
            status="UNPAID",
        )

        db.session.add(ledger_entry)
        db.session.flush()

        account.current_balance = (previous_balance + fine_amount).quantize(CENT)

        _create_audit_trail(
            actor_user=actor_user,
            chama_id=chama_id,
            member_id=member.id,
            actor_role=actor_membership.role,
            action="APPLY_FINE",
            record_id=ledger_entry.id,
            old_data=None,
            new_data={
                "ledger_entry": ledger_entry.to_dict(),
                "previous_balance": _decimal_to_str(previous_balance),
                "new_balance": _decimal_to_str(account.current_balance),
            },
            change_summary="Fine applied; chama cash balance unchanged",
        )

        db.session.commit()

        return (
            jsonify(
                {
                    "ledger_entry_id": ledger_entry.id,
                    "previous_balance": _decimal_to_str(previous_balance),
                    "new_balance": _decimal_to_str(account.current_balance),
                }
            ),
            201,
        )

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Could not apply fine"}), 500


@ledger_bp.route("/chamas/<chama_id>/ledger/adjustment", methods=["POST"])
@jwt_required()
def add_adjustment(chama_id):
    actor_user, actor_membership, error_response = _authorize_for_chama(allowed_roles={TREASURER_ROLE})
    if error_response:
        return error_response

    payload = request.get_json(silent=True) or {}
    member_id = (payload.get("member_id") or "").strip()
    reason = (payload.get("reason") or "").strip()
    reference = (payload.get("reference") or "").strip() or None

    if not member_id:
        return jsonify({"message": "member_id is required"}), 400

    if not reason:
        return jsonify({"message": "reason is required"}), 400

    try:
        amount = _parse_amount(payload.get("amount"), field_name="amount", allow_negative=True)
    except ValidationError as exc:
        return jsonify({"message": str(exc)}), 400

    member = _member_profile(member_id, chama_id)
    if member is None:
        return jsonify({"message": "Member not found in this chama"}), 404

    account = _primary_account(chama_id)
    if account is None:
        return jsonify({"message": "No primary chama account found for this chama"}), 400

    previous_balance = _decimal_from_db(account.current_balance)

    try:
        ledger_entry = LedgerEntry(
            transaction_id=str(uuid4()),
            chama_id=chama_id,
            member_id=member.id,
            chama_account_id=account.id,
            transaction_type="ADJUSTMENT",
            transaction_subtype=reason,
            amount=amount,
            fine_amount=Decimal("0.00"),
            reference=reference,
            transaction_date=_utc_now(),
            due_date=None,
            is_paid=True,
            status="POSTED",
            notes=reason,
        )

        db.session.add(ledger_entry)
        db.session.flush()

        account.current_balance = (previous_balance + amount).quantize(CENT)

        _create_audit_trail(
            actor_user=actor_user,
            chama_id=chama_id,
            member_id=member.id,
            actor_role=actor_membership.role,
            action="ADJUSTMENT",
            record_id=ledger_entry.id,
            old_data=None,
            new_data={
                "ledger_entry": ledger_entry.to_dict(),
                "previous_balance": _decimal_to_str(previous_balance),
                "new_balance": _decimal_to_str(account.current_balance),
            },
            change_summary="Manual adjustment posted and chama balance reconciled",
        )

        db.session.commit()

        return (
            jsonify(
                {
                    "ledger_entry_id": ledger_entry.id,
                    "previous_balance": _decimal_to_str(previous_balance),
                    "new_balance": _decimal_to_str(account.current_balance),
                }
            ),
            201,
        )

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Could not post adjustment"}), 500


@ledger_bp.route("/chamas/<chama_id>/ledger/member/<member_id>", methods=["GET"])
@jwt_required()
def member_statement(chama_id, member_id):
    actor_user, actor_membership, error_response = _authorize_for_chama(allowed_roles=None)
    if error_response:
        return error_response

    target_member = _member_profile(member_id, chama_id)
    if target_member is None:
        return jsonify({"message": "Member not found in this chama"}), 404

    if actor_membership.role != TREASURER_ROLE and target_member.user_id != actor_user.id:
        return jsonify({"message": "Access denied: members can only view their own statement"}), 403

    stmt = (
        select(LedgerEntry)
        .where(
            LedgerEntry.chama_id == chama_id,
            LedgerEntry.member_id == member_id,
        )
        .order_by(
            func.coalesce(LedgerEntry.transaction_date, LedgerEntry.created_at).asc(),
            LedgerEntry.created_at.asc(),
        )
    )
    entries = db.session.execute(stmt).scalars().all()
    aggregates = _statement_aggregates(entries)

    running_balance = Decimal("0.00")
    statement_rows = []

    for entry in entries:
        delta = _debt_delta(entry)
        running_balance = (running_balance + delta).quantize(CENT)

        statement_rows.append(
            {
                "ledger_entry_id": entry.id,
                "transaction_date": _entry_effective_timestamp(entry).isoformat() if _entry_effective_timestamp(entry) else None,
                "transaction_type": entry.transaction_type,
                "transaction_subtype": entry.transaction_subtype,
                "amount": _decimal_to_str(entry.amount),
                "fine_amount": _decimal_to_str(entry.fine_amount),
                "status": entry.status,
                "is_paid": entry.is_paid,
                "running_balance": _decimal_to_str(running_balance),
            }
        )

    return (
        jsonify(
            {
                "member_id": member_id,
                "statement": statement_rows,
                "outstanding_debt": _decimal_to_str(aggregates["outstanding_debt"]),
                "payments": _decimal_to_str(aggregates["total_payments"]),
                "fines": _decimal_to_str(aggregates["total_fines"]),
            }
        ),
        200,
    )


@ledger_bp.route("/chamas/<chama_id>/ledger/balance", methods=["GET"])
@jwt_required()
def chama_balance(chama_id):
    _, _, error_response = _authorize_for_chama(allowed_roles={CHAIRPERSON_ROLE, TREASURER_ROLE})
    if error_response:
        return error_response

    total_balance_stmt = select(func.coalesce(func.sum(ChamaAccount.current_balance), 0)).where(
        ChamaAccount.chama_id == chama_id,
        ChamaAccount.is_primary.is_(True),
        ChamaAccount.is_active.is_(True),
    )
    total_balance = _decimal_from_db(db.session.execute(total_balance_stmt).scalar_one())

    contributions_stmt = select(func.coalesce(func.sum(LedgerEntry.amount), 0)).where(
        LedgerEntry.chama_id == chama_id,
        LedgerEntry.transaction_type == "CONTRIBUTION",
    )
    total_contributions = _decimal_from_db(db.session.execute(contributions_stmt).scalar_one())

    fines_stmt = select(func.coalesce(func.sum(LedgerEntry.fine_amount), 0)).where(
        LedgerEntry.chama_id == chama_id,
        LedgerEntry.transaction_type == "FINE",
    )
    total_fines = _decimal_from_db(db.session.execute(fines_stmt).scalar_one())

    debt_stmt = select(
        func.coalesce(func.sum(LedgerEntry.amount), 0) +
        func.coalesce(func.sum(LedgerEntry.fine_amount), 0)
    ).where(
        LedgerEntry.chama_id == chama_id,
        LedgerEntry.is_paid.is_(False),
    )
    total_debt = _decimal_from_db(db.session.execute(debt_stmt).scalar_one())

    return (
        jsonify(
            {
                "total_balance": _decimal_to_str(total_balance),
                "total_contributions": _decimal_to_str(total_contributions),
                "total_fines": _decimal_to_str(total_fines),
                "total_debt": _decimal_to_str(total_debt),
            }
        ),
        200,
    )


@ledger_bp.route("/chamas/<chama_id>/ledger/all-members", methods=["GET"])
@jwt_required()
def all_members_ledger_summary(chama_id):
    _, _, error_response = _authorize_for_chama(allowed_roles={CHAIRPERSON_ROLE, TREASURER_ROLE})
    if error_response:
        return error_response

    members_stmt = (
        select(MemberProfile, User)
        .join(User, User.id == MemberProfile.user_id)
        .where(MemberProfile.chama_id == chama_id)
        .order_by(User.full_name.asc())
    )
    member_rows = db.session.execute(members_stmt).all()

    response = []

    for member_profile, user in member_rows:
        debt_stmt = select(
            func.coalesce(func.sum(LedgerEntry.amount), 0) +
            func.coalesce(func.sum(LedgerEntry.fine_amount), 0)
        ).where(
            LedgerEntry.chama_id == chama_id,
            LedgerEntry.member_id == member_profile.id,
            LedgerEntry.is_paid.is_(False),
        )
        debt_balance = _decimal_from_db(db.session.execute(debt_stmt).scalar_one())

        last_payment_stmt = select(func.max(func.coalesce(LedgerEntry.transaction_date, LedgerEntry.created_at))).where(
            LedgerEntry.chama_id == chama_id,
            LedgerEntry.member_id == member_profile.id,
            LedgerEntry.transaction_type == "PAYMENT",
        )
        last_payment = db.session.execute(last_payment_stmt).scalar_one()

        response.append(
            {
                "member_name": user.full_name,
                "debt_balance": _decimal_to_str(debt_balance),
                "last_payment": last_payment.isoformat() if last_payment else None,
                "status": "ACTIVE" if member_profile.is_active else "INACTIVE",
            }
        )

    return jsonify(response), 200


@ledger_bp.route("/chamas/<chama_id>/accounts/<account_id>/reconcile", methods=["POST"])
@jwt_required()
def reconcile_account(chama_id, account_id):
    _, _, error_response = _authorize_for_chama(allowed_roles={TREASURER_ROLE})
    if error_response:
        return error_response

    payload = request.get_json(silent=True) or {}
    raw_balance = payload.get("bank_statement_balance")

    if raw_balance in (None, ""):
        return jsonify({"message": "bank_statement_balance is required"}), 400

    try:
        bank_statement_balance = Decimal(str(raw_balance)).quantize(CENT)
    except (InvalidOperation, ValueError):
        return jsonify({"message": "bank_statement_balance must be a valid decimal number"}), 400

    account = db.session.get(ChamaAccount, account_id)
    if account is None or account.chama_id != chama_id:
        return jsonify({"message": "Chama account not found"}), 404

    current_balance = _decimal_from_db(account.current_balance)
    if bank_statement_balance != current_balance:
        return (
            jsonify(
                {
                    "message": "Bank statement balance does not match current balance",
                    "current_balance": _decimal_to_str(current_balance),
                }
            ),
            400,
        )

    actor_user = _current_user()
    actor_membership = _membership_for_user(actor_user.id, chama_id, active_only=True) if actor_user else None

    try:
        old_data = account.to_dict()
        account.reconciliation_status = "RECONCILED"
        account.last_reconciled_date = _utc_now()

        _create_audit_trail(
            actor_user=actor_user,
            chama_id=chama_id,
            member_id=actor_membership.id if actor_membership else None,
            actor_role=actor_membership.role if actor_membership else TREASURER_ROLE,
            action="RECONCILE_ACCOUNT",
            record_id=account.id,
            old_data=old_data,
            new_data=account.to_dict(),
            change_summary="Bank statement matched current balance and account was reconciled",
        )

        db.session.commit()

        return (
            jsonify(
                {
                    "account_id": account.id,
                    "reconciliation_status": account.reconciliation_status,
                    "last_reconciled_date": account.last_reconciled_date.isoformat() if account.last_reconciled_date else None,
                }
            ),
            200,
        )

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Could not reconcile account"}), 500
