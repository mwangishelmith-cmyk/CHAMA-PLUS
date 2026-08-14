import json
from datetime import datetime
from decimal import Decimal
from functools import wraps

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError

from extensions import db
from models import AuditTrail, Chama, ChamaAccount, ChamaCreationRequest, JoinRequest, LedgerEntry, MemberProfile, User
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


def _create_audit_trail(*, actor_user, chama_id, action, record_id, member_id=None, actor_role=None, old_data=None, new_data=None, change_summary=None, table_name="member_profiles"):
    audit_trail = AuditTrail(
        user_id=actor_user.id,
        chama_id=chama_id,
        member_id=member_id,
        role=actor_role,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_data=json.dumps(old_data, ensure_ascii=False) if old_data is not None else None,
        new_data=json.dumps(new_data, ensure_ascii=False) if new_data is not None else None,
        change_summary=change_summary,
        ip_address=request.headers.get("X-Forwarded-For", request.remote_addr),
        user_agent=request.headers.get("User-Agent"),
    )
    db.session.add(audit_trail)


ALLOWED_CREATOR_ROLES = {
    "Chairperson",
    "Treasurer",
    "Secretary",
}


@tenant_bp.route("/chamas", methods=["POST"])
@token_required
def create_chama(current_user=None):
    user = _resolve_current_user(current_user)
    if user is None:
        return jsonify({"message": "Unauthorized"}), 401

    payload = request.get_json(silent=True) or {}

    name = (payload.get("name") or "").strip()
    description = payload.get("description")
    chama_type = (payload.get("chama_type") or "").strip()
    creator_role = (payload.get("creator_role") or "").strip()
    default_contribution_amount = _parse_decimal(payload.get("default_contribution_amount"))

    if not name or not chama_type:
        return jsonify({"message": "name and chama_type are required"}), 400

    if creator_role not in ALLOWED_CREATOR_ROLES:
        return jsonify(
            {"message": "creator_role must be one of Chairperson, Treasurer, or Secretary"}
        ), 400

    try:
        creation_request = ChamaCreationRequest(
            requested_by=user.id,
            name=name,
            description=description,
            chama_type=chama_type,
            default_contribution_amount=default_contribution_amount,
            creator_role=creator_role,
            status="PENDING",
        )
        db.session.add(creation_request)

        _create_audit_trail(
            actor_user=user,
            chama_id=None,
            action="REQUEST_CHAMA",
            record_id=creation_request.id,
            old_data=None,
            new_data=creation_request.to_dict(),
            change_summary="Chama creation request submitted",
            table_name="chama_creation_requests",
        )

        db.session.commit()

        return (
            jsonify(
                {
                    "request_id": creation_request.id,
                    "status": creation_request.status,
                    "message": "Chama creation request submitted successfully.",
                }
            ),
            201,
        )

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Could not submit chama creation request"}), 500


@tenant_bp.route("/chama-requests", methods=["GET"])
@token_required
def list_chama_requests(current_user=None):
    user = _resolve_current_user(current_user)
    if user is None:
        return jsonify({"message": "Unauthorized"}), 401

    if not user.is_super_admin:
        return jsonify({"message": "Access denied: super admin only"}), 403

    pending_requests = (
        ChamaCreationRequest.query.filter_by(status="PENDING")
        .order_by(ChamaCreationRequest.created_at.asc())
        .all()
    )

    return (
        jsonify(
            [
                {
                    **creation_request.to_dict(),
                    "status": creation_request.status,
                }
                for creation_request in pending_requests
            ]
        ),
        200,
    )


@tenant_bp.route("/chama-requests/<request_id>/approve", methods=["PUT"])
@token_required
def approve_chama_request(request_id, current_user=None):
    user = _resolve_current_user(current_user)
    if user is None:
        return jsonify({"message": "Unauthorized"}), 401

    if not user.is_super_admin:
        return jsonify({"message": "Access denied: super admin only"}), 403

    creation_request = db.session.get(ChamaCreationRequest, request_id)
    if creation_request is None:
        return jsonify({"message": "Chama creation request not found"}), 404

    if creation_request.status != "PENDING":
        return jsonify({"message": "Only pending requests can be approved"}), 400

    try:
        creation_request_snapshot = creation_request.to_dict()

        chama = Chama(
            name=creation_request.name,
            description=creation_request.description,
            chama_type=creation_request.chama_type,
            default_contribution_amount=creation_request.default_contribution_amount,
            created_by=creation_request.requested_by,
            registration_date=_utc_now(),
        )
        db.session.add(chama)

        db.session.flush()  # Flush to get chama.id before creating the linked account and membership.

        account = ChamaAccount(
            chama_id=chama.id,
            account_name="Main Chama Account",
            institution_name=None,
            account_type="CASH/MPESA",
            account_number=None,
            opening_balance=Decimal("0.00"),
            current_balance=Decimal("0.00"),
            is_primary=True,
            is_active=True,
        )

        db.session.add(account)
        # Flush first so the database assigns chama.id before we create the linked creator membership.
        db.session.flush()

        creator_membership = MemberProfile(
            user_id=creation_request.requested_by,
            chama_id=chama.id,
            role=creation_request.creator_role,
            joined_date=_utc_now(),
            is_active=True,
        )
        db.session.add(creator_membership)

        creation_request.status = "APPROVED"
        creation_request.approved_by = user.id
        creation_request.approved_at = _utc_now()

        _create_audit_trail(
            actor_user=user,
            chama_id=chama.id,
            action="APPROVE_CHAMA",
            record_id=creation_request.id,
            old_data=creation_request_snapshot,
            new_data=creation_request.to_dict(),
            change_summary="Chama creation request approved",
            table_name="chama_creation_requests",
        )

        db.session.commit()

        return jsonify({"message": "Chama approved successfully.", "chama_id": chama.id}), 200

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Could not approve chama creation request"}), 500


@tenant_bp.route("/chama-requests/<request_id>/reject", methods=["PUT"])
@token_required
def reject_chama_request(request_id, current_user=None):
    user = _resolve_current_user(current_user)
    if user is None:
        return jsonify({"message": "Unauthorized"}), 401

    if not user.is_super_admin:
        return jsonify({"message": "Access denied: super admin only"}), 403

    creation_request = db.session.get(ChamaCreationRequest, request_id)
    if creation_request is None:
        return jsonify({"message": "Chama creation request not found"}), 404

    if creation_request.status != "PENDING":
        return jsonify({"message": "Only pending requests can be rejected"}), 400

    try:
        creation_request_snapshot = creation_request.to_dict()

        creation_request.status = "REJECTED"
        creation_request.approved_by = user.id
        creation_request.approved_at = _utc_now()

        _create_audit_trail(
            actor_user=user,
            chama_id=None,
            action="REJECT_CHAMA",
            record_id=creation_request.id,
            old_data=creation_request_snapshot,
            new_data=creation_request.to_dict(),
            change_summary="Chama creation request rejected",
            table_name="chama_creation_requests",
        )

        db.session.commit()

        return jsonify({"message": "Chama creation request rejected successfully."}), 200

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Could not reject chama creation request"}), 500


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
    chama_type = payload.get("chama_type")
    description = payload.get("description")
    default_contribution_amount = payload.get("default_contribution_amount")
    late_fine_amount = payload.get("late_fine_amount")

    try:
        if name is not None:
            name = name.strip()
            if not name:
                return jsonify({"message": "name cannot be empty"}), 400
            chama.name = name

        if chama_type is not None:
            chama_type = chama_type.strip()
            if not chama_type:
                return jsonify({"message": "chama_type cannot be empty"}), 400
            chama.chama_type = chama_type

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
    allowed_roles = {"Chairperson", "Treasurer"}
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


@tenant_bp.route("/chamas/<chama_id>/join", methods=["POST"])
@token_required
def submit_join_request(chama_id, current_user=None):
    """
    Submit a request to join an existing chama.

    User must be authenticated but does NOT need to be a current member.
    Validates that the chama exists, user is not already a member, and
    no existing PENDING request exists for this user/chama combination.
    """
    user = _resolve_current_user(current_user)
    if user is None:
        return jsonify({"message": "Unauthorized"}), 401

    chama = db.session.get(Chama, chama_id)
    if chama is None:
        return jsonify({"message": "Chama not found"}), 404

    # Check if user is already an active member
    existing_membership = _membership_for_user(user.id, chama_id, active_only=True)
    if existing_membership:
        return jsonify({"message": "User is already an active member of this chama"}), 409

    # Check for existing PENDING request to prevent duplicates
    existing_pending_request = JoinRequest.query.filter_by(
        user_id=user.id, chama_id=chama_id, status="PENDING"
    ).first()
    if existing_pending_request:
        return jsonify({"message": "A pending join request already exists for this chama"}), 409

    try:
        join_request = JoinRequest(
            user_id=user.id,
            chama_id=chama_id,
            status="PENDING",
            requested_at=_utc_now(),
        )
        db.session.add(join_request)
        db.session.flush()

        # Record the join request submission in audit trail
        _create_audit_trail(
            actor_user=user,
            chama_id=chama_id,
            action="JOIN_REQUEST_SUBMITTED",
            record_id=join_request.id,
            old_data=None,
            new_data=join_request.to_dict(),
            change_summary="User submitted request to join chama",
            table_name="join_requests",
        )

        db.session.commit()

        return (
            jsonify(
                {
                    "message": "Join request submitted successfully.",
                    "request_id": join_request.id,
                    "status": join_request.status,
                }
            ),
            201,
        )

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Could not submit join request"}), 500


@tenant_bp.route("/join-requests", methods=["GET"])
@token_required
def list_my_join_requests(current_user=None):
    """
    Retrieve all join requests created by the authenticated user.

    Returns all requests (PENDING, APPROVED, REJECTED) in created order.
    """
    user = _resolve_current_user(current_user)
    if user is None:
        return jsonify({"message": "Unauthorized"}), 401

    join_requests = (
        JoinRequest.query.filter_by(user_id=user.id)
        .order_by(JoinRequest.requested_at.desc())
        .all()
    )

    return (
        jsonify(
            [
                {
                    **join_request.to_dict(),
                    "chama_name": join_request.chama.name,
                }
                for join_request in join_requests
            ]
        ),
        200,
    )


@tenant_bp.route("/chamas/<chama_id>/join-requests", methods=["GET"])
@token_required
def list_pending_join_requests(chama_id, current_user=None):
    """
    List all pending join requests for a chama.

    Authorization: Chairperson or Treasurer only.
    """
    allowed_roles = {"Chairperson", "Treasurer"}
    actor_user, actor_membership, error_response = _actor_membership(
        current_user, chama_id, allowed_roles=allowed_roles
    )
    if error_response:
        return error_response

    chama = db.session.get(Chama, chama_id)
    if chama is None:
        return jsonify({"message": "Chama not found"}), 404

    pending_requests = (
        JoinRequest.query.filter_by(chama_id=chama_id, status="PENDING")
        .order_by(JoinRequest.requested_at.asc())
        .all()
    )

    return (
        jsonify(
            [
                {
                    **join_request.to_dict(),
                    "user_name": join_request.user.full_name,
                    "user_email": join_request.user.email,
                }
                for join_request in pending_requests
            ]
        ),
        200,
    )


@tenant_bp.route("/chamas/<chama_id>/join-requests/<request_id>/approve", methods=["PUT"])
@token_required
def approve_join_request(chama_id, request_id, current_user=None):
    """
    Approve a pending join request.

    Atomically:
    - Create a MemberProfile with role="Member"
    - Update JoinRequest status to APPROVED
    - Record the approval in audit trail

    Authorization: Chairperson or Treasurer only.
    """
    allowed_roles = {"Chairperson", "Treasurer"}
    actor_user, actor_membership, error_response = _actor_membership(
        current_user, chama_id, allowed_roles=allowed_roles
    )
    if error_response:
        return error_response

    join_request = db.session.get(JoinRequest, request_id)
    if join_request is None:
        return jsonify({"message": "Join request not found"}), 404

    if join_request.chama_id != chama_id:
        return jsonify({"message": "Join request does not belong to this chama"}), 400

    if join_request.status != "PENDING":
        return jsonify({"message": "Only pending requests can be approved"}), 400

    try:
        join_request_snapshot = join_request.to_dict()

        # Check one more time that user is not already a member (defensive check)
        existing_membership = _membership_for_user(join_request.user_id, chama_id, active_only=True)
        if existing_membership:
            return jsonify({"message": "User is already a member of this chama"}), 409

        # Create the MemberProfile for the requesting user
        member_profile = MemberProfile(
            user_id=join_request.user_id,
            chama_id=chama_id,
            role="Member",
            joined_date=_utc_now(),
            is_active=True,
        )
        db.session.add(member_profile)

        # Flush to get the member_profile.id before updating the join_request
        db.session.flush()

        # Update the join request record
        join_request.status = "APPROVED"
        join_request.reviewed_by = actor_user.id
        join_request.reviewed_at = _utc_now()

        # Record the approval in audit trail
        _create_audit_trail(
            actor_user=actor_user,
            chama_id=chama_id,
            action="JOIN_REQUEST_APPROVED",
            record_id=join_request.id,
            member_id=member_profile.id,
            actor_role=actor_membership.role,
            old_data=join_request_snapshot,
            new_data=join_request.to_dict(),
            change_summary="Join request approved and member added to chama",
            table_name="join_requests",
        )

        db.session.commit()

        return (
            jsonify(
                {
                    "message": "Member approved successfully.",
                    "member_id": member_profile.id,
                }
            ),
            200,
        )

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Could not approve join request"}), 500


@tenant_bp.route("/chamas/<chama_id>/join-requests/<request_id>/reject", methods=["PUT"])
@token_required
def reject_join_request(chama_id, request_id, current_user=None):
    """
    Reject a pending join request.

    Optionally accepts remarks in the request body.
    Does NOT create a MemberProfile.

    Authorization: Chairperson or Treasurer only.
    """
    allowed_roles = {"Chairperson", "Treasurer"}
    actor_user, actor_membership, error_response = _actor_membership(
        current_user, chama_id, allowed_roles=allowed_roles
    )
    if error_response:
        return error_response

    join_request = db.session.get(JoinRequest, request_id)
    if join_request is None:
        return jsonify({"message": "Join request not found"}), 404

    if join_request.chama_id != chama_id:
        return jsonify({"message": "Join request does not belong to this chama"}), 400

    if join_request.status != "PENDING":
        return jsonify({"message": "Only pending requests can be rejected"}), 400

    try:
        payload = request.get_json(silent=True) or {}
        remarks = payload.get("remarks")

        join_request_snapshot = join_request.to_dict()

        join_request.status = "REJECTED"
        join_request.reviewed_by = actor_user.id
        join_request.reviewed_at = _utc_now()
        if remarks:
            join_request.remarks = remarks.strip()

        # Record the rejection in audit trail
        _create_audit_trail(
            actor_user=actor_user,
            chama_id=chama_id,
            action="JOIN_REQUEST_REJECTED",
            record_id=join_request.id,
            actor_role=actor_membership.role,
            old_data=join_request_snapshot,
            new_data=join_request.to_dict(),
            change_summary="Join request rejected",
            table_name="join_requests",
        )

        db.session.commit()

        return (
            jsonify({"message": "Join request rejected successfully."}),
            200,
        )

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Could not reject join request"}), 500