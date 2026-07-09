"""Seed the initial Super Admin user for ChamaPlus.

This script is intentionally standalone so it can be run independently of the
API route modules and reused during development or future deployments.
"""

from pathlib import Path
import sys

from sqlalchemy.exc import SQLAlchemyError
from werkzeug.security import generate_password_hash


BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app import create_app, db  # noqa: E402
from models import User  # noqa: E402


SUPER_ADMIN_EMAIL = "admin@chamaplus.com"


def seed_super_admin():
    """Create the platform Super Admin if it does not already exist."""
    app = create_app()

    with app.app_context():
        try:
            existing_user = User.query.filter_by(email=SUPER_ADMIN_EMAIL).first()
            if existing_user is not None:
                print("Super Admin already exists.")
                return

            # The seed runs inside the Flask app context so Flask-SQLAlchemy can use the active session.
            super_admin = User(
                full_name="Platform Administrator",
                email=SUPER_ADMIN_EMAIL,
                phone_number="0700000000",
                password_hash=generate_password_hash("Admin123!"),
                email_verified=True,
                is_super_admin=True,
            )

            db.session.add(super_admin)
            db.session.commit()

            print(f"Super Admin created successfully: {super_admin.email}")

        except SQLAlchemyError:
            db.session.rollback()
            print("Failed to create Super Admin due to a database error.")
            raise


if __name__ == "__main__":
    seed_super_admin()