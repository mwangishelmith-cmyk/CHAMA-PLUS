from datetime import datetime, timedelta
from functools import wraps
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
from flask import Blueprint, current_app, jsonify, request
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.security import check_password_hash, generate_password_hash
from app import db
from models import MemberProfile, User


auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1")


def _get_jwt_secret():
    return current_app.config.get("JWT_SECRET_KEY", current_app.config.get("SECRET_KEY"))


def _create_access_token(user_id):
    payload = {
        "sub": user_id,
        "iat": datetime.utcnow(),
        # token expiration "exp" set to 1 minute for testing purposes; adjust as needed for production
        "exp": datetime.utcnow() + timedelta(minutes=1),   
    }
    return jwt.encode(payload, _get_jwt_secret(), algorithm="HS256")


def _get_bearer_token():
    authorization_header = request.headers.get("Authorization", "")
    if not authorization_header.startswith("Bearer "):
        return None
    return authorization_header.split(" ", 1)[1].strip() or None


def _get_memberships(user_id):
    memberships = (
        MemberProfile.query.filter_by(user_id=user_id, is_active=True)
        .all()
    )
    return [
        {
            "chama_id": membership.chama_id,
            "role": membership.role,
        }
        for membership in memberships
    ]


def token_required(view_function):
    # Stateless JWT auth: decode the token and inject the User into the route handler.
    @wraps(view_function)
    def wrapped(*args, **kwargs):
        token = _get_bearer_token()
        if not token:
            return jsonify({"message": "Missing or invalid authorization token"}), 401

        try:
            decoded_token = jwt.decode(
                token,
                _get_jwt_secret(),
                algorithms=["HS256"],
                options={"require": ["sub", "exp"]},
            )
            user_id = decoded_token.get("sub")
            if not user_id:
                return jsonify({"message": "Invalid token payload"}), 401

            current_user = db.session.get(User, user_id)
            if current_user is None:
                return jsonify({"message": "User not found"}), 401

        except ExpiredSignatureError:
            return jsonify({"message": "Token has expired"}), 401
        except InvalidTokenError:
            return jsonify({"message": "Invalid token"}), 401

        kwargs["current_user"] = current_user
        return view_function(*args, **kwargs)

    return wrapped


@auth_bp.route("/auth/register", methods=["POST"])
def register():
    payload = request.get_json(silent=True) or {}

    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    full_name = (payload.get("full_name") or "").strip()
    phone_number = payload.get("phone_number")

    if not email or not password or not full_name:
        return jsonify(
            {
                "message": "email, password, and full_name are required",
            }
        ), 400

    existing_user = User.query.filter_by(email=email).first()
    if existing_user is not None:
        return jsonify({"message": "A user with this email already exists"}), 409

    try:
        new_user = User(
            email=email,
            password_hash=generate_password_hash(password),
            full_name=full_name,
            phone_number=phone_number,
            email_verified=False,
            is_super_admin=False,
        )

        db.session.add(new_user)
        db.session.commit()

        token = _create_access_token(new_user.id)

        return jsonify(
            {
                "user_id": new_user.id,
                "message": "User registered successfully",
                "token": token,
            }
        ), 201

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Could not register user"}), 500


@auth_bp.route("/auth/login", methods=["POST"])
def login():
    payload = request.get_json(silent=True) or {}

    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not email or not password:
        return jsonify({"message": "email and password are required"}), 400

    user = User.query.filter_by(email=email).first()
    if user is None or not check_password_hash(user.password_hash, password):
        return jsonify({"message": "Invalid email or password"}), 401

    try:
        user.last_login = datetime.utcnow()
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()

    token = _create_access_token(user.id)
    memberships = _get_memberships(user.id)

    return jsonify(
        {
            "token": token,
            "user_id": user.id,
            "full_name": user.full_name,
            "memberships": memberships,
        }
    ), 200


@auth_bp.route("/auth/logout", methods=["POST"])
@token_required
def logout(current_user):
    # JWT is stateless; logout means the client discards the token.
    return jsonify({"message": "Logged out successfully"}), 200


@auth_bp.route("/users/me", methods=["GET"])
@token_required
def get_me(current_user):
    user_profile = current_user.to_dict()
    memberships = _get_memberships(current_user.id)

    return jsonify(
        {
            "user_profile": user_profile,
            "memberships": memberships,
        }
    ), 200


@auth_bp.route("/users/me", methods=["PUT"])
@token_required
def update_me(current_user):
    payload = request.get_json(silent=True) or {}

    full_name = payload.get("full_name")
    phone_number = payload.get("phone_number")

    if full_name is None and phone_number is None:
        return jsonify({"message": "At least one field must be provided"}), 400

    try:
        if full_name is not None:
            full_name = full_name.strip()
            if not full_name:
                return jsonify({"message": "full_name cannot be empty"}), 400
            current_user.full_name = full_name

        if phone_number is not None:
            current_user.phone_number = phone_number

        db.session.commit()

        return jsonify(
            {
                "updated_profile": current_user.to_dict(),
            }
        ), 200

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Could not update profile"}), 500