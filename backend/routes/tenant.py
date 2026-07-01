import json
from datetime import datetime
from decimal import Decimal
from functools import wraps

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError

from app import db
from models import AuditTrail, Chama, ChamaAccount, LedgerEntry, MemberProfile, User
from routes.auth import token_required


tenant_bp = Blueprint("tenant", __name__, url_prefix="/api/v1")


def _resolve_current_user(current_user=None):
    return current_user or getattr(g, "current_user", None)


def _parse_decimal(value):
    if value in (None, ""):
        return None
    return Decimal(str(value))


def _utc_now():
    return datetime.utcnow()


def _membership_for_user(user_id, chama_id, active_only=True):
    query = MemberProfile.query.filter_by(user_id=user_id, chama_id=chama_id)
    if active_only:
        query = query.filter_by(is_active=True)
    return query.first()


def _actor_membership(current_user, chama_id, allowed_roles=None):
    user = _resolve_current_user(current_user)
    if user is None:
        return None, None, (jsonify({"message": "Unauthorized"}), 401)

    membership = _membership_for_user(user.id, chama_id, active_only=True)
    if membership is None:
        return user, None, (jsonify({"message": "Access denied: chama membership required"}), 403)

    if allowed_roles and membership.role not in allowed_roles:
        return user, membership, (jsonify({"message": "Access denied: insufficient permissions"}), 403)

    return user, membership, None


def _create_audit_trail(*, actor_user, chama_id, action, record_id, member_id=None, actor_role=None, old_data=None, new_data=None, change_summary=None):
    audit_trail = AuditTrail(
        user_id=actor_user.id,
        chama_id=chama_id,
        member_id=member_id,
        role=actor_role,
        action=action,
        table_name="member_profiles",
        record_id=record_id,
        old_data=json.dumps(old_data, ensure_ascii=False) if old_data is not None else None,
        new_data=json.dumps(new_data, ensure_ascii=False) if new_data is not None else None,
        change_summary=change_summary,
        ip_address=request.headers.get("X-Forwarded-For", request.remote_addr),
        user_agent=request.headers.get("User-Agent"),
    )
    db.session.add(audit_trail)


@tenant_bp.route("/chamas", methods=["POST"])
@token_required
def create_chama(current_user=None):
    user = _resolve_current_user(current_user)
    if user is None:
        return jsonify({"message": "Unauthorized"}), 401

    if not user.is_super_admin:
        return jsonify({"message": "Access denied: super admin only"}), 403

    payload = request.get_json(silent=True) or {}

    name = (payload.get("name") or "").strip()
    description = payload.get("description")
    chama_type = (payload.get("chama_type") or "").strip()
    default_contribution_amount = _parse_decimal(payload.get("default_contribution_amount"))

    if not name or not chama_type:
        return jsonify({"message": "name and chama_type are required"}), 400

    try:
        chama = Chama(
            name=name,
            description=description,
            chama_type=chama_type,
            default_contribution_amount=default_contribution_amount,
            created_by=user.id,
            registration_date=_utc_now(),
        )
        db.session.add(chama)
        db.session.commit()

        return (
            jsonify(
                {
                    "chama_id": chama.id,
                    "name": chama.name,
                    "created_by": chama.created_by,
                    "registration_date": chama.registration_date.isoformat() if chama.registration_date else None,
                }
            ),
            201,
        )

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Could not create chama"}), 500


@tenant_bp.route("/chamas", methods=["GET"])
@token_required
def list_chamas(current_user=None):
    user = _resolve_current_user(current_user)
    if user is None:
        return jsonify({"message": "Unauthorized"}), 401

    debt_balance_expr = func.coalesce(func.sum(LedgerEntry.amount), 0) + func.coalesce(func.sum(LedgerEntry.fine_amount), 0)

    rows = (
        db.session.query(
            Chama.id.label("chama_id"),
            Chama.name.label("name"),
            MemberProfile.role.label("role"),
            debt_balance_expr.label("debt_balance"),
        )
        .join(MemberProfile, MemberProfile.chama_id == Chama.id)
        .outerjoin(
            LedgerEntry,
            (LedgerEntry.member_id == MemberProfile.id) & (LedgerEntry.is_paid.is_(False)),
        )
        .filter(
            MemberProfile.user_id == user.id,
            MemberProfile.is_active.is_(True),
        )
        .group_by(Chama.id, Chama.name, MemberProfile.role)
        .all()
    )

    return (
        jsonify(
            [
                {
                    "chama_id": row.chama_id,
                    "name": row.name,
                    "role": row.role,
                    "debt_balance": str(row.debt_balance or 0),
                }
                for row in rows
            ]
        ),
        200,
    )


@tenant_bp.route("/chamas/<chama_id>", methods=["GET"])
@token_required
def get_chama(chama_id, current_user=None):
    user, membership, error_response = _actor_membership(current_user, chama_id)
    if error_response:
        return error_response

    chama = db.session.get(Chama, chama_id)
    if chama is None:
        return jsonify({"message": "Chama not found"}), 404

    members_count = (
        db.session.query(func.count(MemberProfile.id))
        .filter(
            MemberProfile.chama_id == chama_id,
            MemberProfile.is_active.is_(True),
        )
        .scalar()
        or 0
    )

    total_balance = (
        db.session.query(func.coalesce(func.sum(ChamaAccount.current_balance), 0))
        .filter(
            ChamaAccount.chama_id == chama_id,
            ChamaAccount.is_active.is_(True),
        )
        .scalar()
        or 0
    )

    return (
        jsonify(
            {
                "chama_details": chama.to_dict(),
                "members_count": members_count,
                "total_balance": str(total_balance),
            }
        ),
        200,
    )


@tenant_bp.route("/chamas/<chama_id>", methods=["PUT"])
@token_required
def update_chama(chama_id, current_user=None):
    allowed_roles = {"Chairperson", "Treasurer"}
    user, membership, error_response = _actor_membership(current_user, chama_id, allowed_roles=allowed_roles)
    if error_response:
        return error_response

    chama = db.session.get(Chama, chama_id)
    if chama is None:
        return jsonify({"message": "Chama not found"}), 404

    payload = request.get_json(silent=True) or {}

    name = payload.get("name")
    description = payload.get("description")
    default_contribution_amount = payload.get("default_contribution_amount")
    late_fine_amount = payload.get("late_fine_amount")

    try:
        if name is not None:
            name = name.strip()
            if not name:
                return jsonify({"message": "name cannot be empty"}), 400
            chama.name = name

        if description is not None:
            chama.description = description

        if default_contribution_amount is not None:
            chama.default_contribution_amount = _parse_decimal(default_contribution_amount)

        if late_fine_amount is not None:
            chama.late_fine_amount = _parse_decimal(late_fine_amount)

        db.session.commit()

        return (
            jsonify(
                {
                    "updated_chama_details": chama.to_dict(),
                }
            ),
            200,
        )

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Could not update chama"}), 500


@tenant_bp.route("/chamas/<chama_id>/members", methods=["POST"])
@token_required
def add_member(chama_id, current_user=None):
    allowed_roles = {"Chairperson", "Treasurer"}
    actor_user, actor_membership, error_response = _actor_membership(current_user, chama_id, allowed_roles=allowed_roles)
    if error_response:
        return error_response

    chama = db.session.get(Chama, chama_id)
    if chama is None:
        return jsonify({"message": "Chama not found"}), 404

    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    new_role = (payload.get("role") or "").strip()

    if not email or not new_role:
        return jsonify({"message": "email and role are required"}), 400

    target_user = User.query.filter_by(email=email).first()
    if target_user is None:
        return jsonify({"message": "User not found"}), 404

    existing_membership = _membership_for_user(target_user.id, chama_id, active_only=False)
    if existing_membership and existing_membership.is_active:
        return jsonify({"message": "User is already an active member of this chama"}), 409

    try:
        if existing_membership:
            old_data = existing_membership.to_dict()
            existing_membership.role = new_role
            existing_membership.is_active = True
            existing_membership.joined_date = _utc_now()
            existing_membership.last_contribution_date = existing_membership.last_contribution_date
            member = existing_membership
            action_summary = "Member reactivated and added to chama"
        else:
            member = MemberProfile(
                user_id=target_user.id,
                chama_id=chama_id,
                role=new_role,
                joined_date=_utc_now(),
                is_active=True,
            )
            db.session.add(member)
            db.session.flush()
            old_data = None
            action_summary = "Member added to chama"

        _create_audit_trail(
            actor_user=actor_user,
            chama_id=chama_id,
            action="ADD_MEMBER",
            record_id=member.id,
            member_id=member.id,
            actor_role=actor_membership.role if actor_membership else None,
            old_data=old_data if existing_membership else None,
            new_data=member.to_dict(),
            change_summary=action_summary,
        )

        db.session.commit()

        return (
            jsonify(
                {
                    "member_id": member.id,
                    "user_id": member.user_id,
                    "role": member.role,
                    "joined_date": member.joined_date.isoformat() if member.joined_date else None,
                }
            ),
            201,
        )

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Could not add member"}), 500


@tenant_bp.route("/chamas/<chama_id>/members/<member_id>", methods=["PUT"])
@token_required
def update_member(chama_id, member_id, current_user=None):
    allowed_roles = {"Treasurer"}
    actor_user, actor_membership, error_response = _actor_membership(current_user, chama_id, allowed_roles=allowed_roles)
    if error_response:
        return error_response

    member = MemberProfile.query.filter_by(id=member_id, chama_id=chama_id).first()
    if member is None:
        return jsonify({"message": "Member not found"}), 404

    payload = request.get_json(silent=True) or {}
    role = payload.get("role")
    is_active = payload.get("is_active")

    if role is None and is_active is None:
        return jsonify({"message": "At least one field must be provided"}), 400

    try:
        old_data = member.to_dict()

        if role is not None:
            role = role.strip()
            if not role:
                return jsonify({"message": "role cannot be empty"}), 400
            member.role = role

        if is_active is not None:
            member.is_active = bool(is_active)

        db.session.flush()

        _create_audit_trail(
            actor_user=actor_user,
            chama_id=chama_id,
            action="UPDATE_MEMBER",
            record_id=member.id,
            member_id=member.id,
            actor_role=actor_membership.role if actor_membership else None,
            old_data=old_data,
            new_data=member.to_dict(),
            change_summary="Member profile updated",
        )

        db.session.commit()

        return (
            jsonify(
                {
                    "updated_member_details": member.to_dict(),
                }
            ),
            200,
        )

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Could not update member"}), 500


@tenant_bp.route("/chamas/<chama_id>/members/<member_id>", methods=["DELETE"])
@token_required
def remove_member(chama_id, member_id, current_user=None):
    allowed_roles = {"Treasurer"}
    actor_user, actor_membership, error_response = _actor_membership(current_user, chama_id, allowed_roles=allowed_roles)
    if error_response:
        return error_response

    member = MemberProfile.query.filter_by(id=member_id, chama_id=chama_id).first()
    if member is None:
        return jsonify({"message": "Member not found"}), 404

    try:
        old_data = member.to_dict()
        member.is_active = False

        _create_audit_trail(
            actor_user=actor_user,
            chama_id=chama_id,
            action="REMOVE_MEMBER",
            record_id=member.id,
            member_id=member.id,
            actor_role=actor_membership.role if actor_membership else None,
            old_data=old_data,
            new_data=member.to_dict(),
            change_summary="Member removed from chama",
        )

        db.session.commit()

        return jsonify({"message": "Member removed"}), 200

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Could not remove member"}), 500