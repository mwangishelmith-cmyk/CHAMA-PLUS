from datetime import datetime
from decimal import Decimal
from uuid import uuid4
from app import db


# Abstract base so SQLAlchemy does not create a separate table for shared fields.
class BaseModel(db.Model):
    __abstract__ = True

    # Common identifiers and audit timestamps are inherited by all concrete models.
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        data = {}
        for column in self.__table__.columns:
            value = getattr(self, column.name)
            if isinstance(value, datetime):
                value = value.isoformat()
            elif isinstance(value, Decimal):
                value = str(value)
            data[column.name] = value
        return data


class User(BaseModel):
    __tablename__ = "users"

    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(255), nullable=False)
    phone_number = db.Column(db.String(50), nullable=True)
    is_super_admin = db.Column(db.Boolean, default=False, nullable=False)
    last_login = db.Column(db.DateTime, nullable=True)
    email_verified = db.Column(db.Boolean, default=False, nullable=False)

    member_profiles = db.relationship("MemberProfile", back_populates="user", cascade="all, delete-orphan")
    audit_trails = db.relationship("AuditTrail", back_populates="user", cascade="all, delete-orphan")
    chamas_created = db.relationship("Chama", back_populates="created_by_user", foreign_keys="Chama.created_by")

    # Explicit override to guarantee password_hash is never serialized.
    def to_dict(self):
        data = super().to_dict()
        data.pop("password_hash", None)
        return data


class Chama(BaseModel):
    __tablename__ = "chamas"

    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    chama_type = db.Column(db.String(50), nullable=False)
    registration_date = db.Column(db.DateTime, nullable=True)
    created_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    default_contribution_amount = db.Column(db.Numeric(12, 2), nullable=True)
    contribution_frequency = db.Column(db.String(50), nullable=True)
    contribution_due_day = db.Column(db.Integer, nullable=True)
    late_fine_amount = db.Column(db.Numeric(12, 2), nullable=True)
    late_fine_days_grace = db.Column(db.Integer, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    created_by_user = db.relationship("User", back_populates="chamas_created", foreign_keys=[created_by])
    member_profiles = db.relationship("MemberProfile", back_populates="chama", cascade="all, delete-orphan")
    chama_accounts = db.relationship("ChamaAccount", back_populates="chama", cascade="all, delete-orphan")
    ledger_entries = db.relationship("LedgerEntry", back_populates="chama", cascade="all, delete-orphan")
    audit_trails = db.relationship("AuditTrail", back_populates="chama", cascade="all, delete-orphan")


class MemberProfile(BaseModel):
    __tablename__ = "member_profiles"
    __table_args__ = (db.UniqueConstraint("user_id", "chama_id", name="uq_member_profile_user_chama"),)

    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    chama_id = db.Column(db.String(36), db.ForeignKey("chamas.id"), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    joined_date = db.Column(db.DateTime, nullable=True)
    last_contribution_date = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    user = db.relationship("User", back_populates="member_profiles")
    chama = db.relationship("Chama", back_populates="member_profiles")
    ledger_entries = db.relationship("LedgerEntry", back_populates="member", cascade="all, delete-orphan")
    audit_trails = db.relationship("AuditTrail", back_populates="member", cascade="all, delete-orphan")


class ChamaAccount(BaseModel):
    __tablename__ = "chama_accounts"

    chama_id = db.Column(db.String(36), db.ForeignKey("chamas.id"), nullable=False)
    account_name = db.Column(db.String(255), nullable=False)
    institution_name = db.Column(db.String(255), nullable=True)
    account_type = db.Column(db.String(50), nullable=False)
    account_number = db.Column(db.String(100), nullable=True)
    opening_balance = db.Column(db.Numeric(12, 2), nullable=True)
    current_balance = db.Column(db.Numeric(12, 2), nullable=True)
    last_reconciled_date = db.Column(db.DateTime, nullable=True)
    reconciliation_status = db.Column(db.String(50), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    chama = db.relationship("Chama", back_populates="chama_accounts")
    ledger_entries = db.relationship("LedgerEntry", back_populates="chama_account", cascade="all, delete-orphan")


class LedgerEntry(BaseModel):
    __tablename__ = "ledger_entries"

    transaction_id = db.Column(db.String(100), nullable=True)
    chama_id = db.Column(db.String(36), db.ForeignKey("chamas.id"), nullable=False)
    member_id = db.Column(db.String(36), db.ForeignKey("member_profiles.id"), nullable=True)
    chama_account_id = db.Column(db.String(36), db.ForeignKey("chama_accounts.id"), nullable=True)
    transaction_type = db.Column(db.String(50), nullable=False)
    transaction_subtype = db.Column(db.String(50), nullable=True)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    fine_amount = db.Column(db.Numeric(12, 2), nullable=True)
    reference = db.Column(db.String(255), nullable=True)
    sequence_number = db.Column(db.Integer, nullable=True)
    transaction_date = db.Column(db.DateTime, nullable=True)
    due_date = db.Column(db.DateTime, nullable=True)
    is_paid = db.Column(db.Boolean, default=False, nullable=False)
    status = db.Column(db.String(50), nullable=True)
    notes = db.Column(db.Text, nullable=True)

    chama = db.relationship("Chama", back_populates="ledger_entries")
    member = db.relationship("MemberProfile", back_populates="ledger_entries")
    chama_account = db.relationship("ChamaAccount", back_populates="ledger_entries")
    audit_trails = db.relationship("AuditTrail", back_populates="ledger_entry", cascade="all, delete-orphan")

    @property
    def debt(self):
        previous_balance = 0
        unpaid_contributions = 0
        event_contributions = 0
        fines = 0
        payments_made = 0
        return previous_balance + unpaid_contributions + event_contributions + fines - payments_made

    def to_dict(self):
        data = super().to_dict()
        data["debt"] = self.debt
        return data


class AuditTrail(BaseModel):
    __tablename__ = "audit_trails"

    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    chama_id = db.Column(db.String(36), db.ForeignKey("chamas.id"), nullable=False)
    member_id = db.Column(db.String(36), db.ForeignKey("member_profiles.id"), nullable=True)
    role = db.Column(db.String(100), nullable=True)
    ip_address = db.Column(db.String(100), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    action = db.Column(db.String(50), nullable=False)
    table_name = db.Column(db.String(100), nullable=False)
    record_id = db.Column(db.String(100), nullable=True)
    ledger_entry_id = db.Column(db.String(36), db.ForeignKey("ledger_entries.id"), nullable=True)
    old_data = db.Column(db.Text, nullable=True)
    new_data = db.Column(db.Text, nullable=True)
    change_summary = db.Column(db.Text, nullable=True)
    previous_hash = db.Column(db.String(255), nullable=True)
    current_hash = db.Column(db.String(255), nullable=True)

    user = db.relationship("User", back_populates="audit_trails")
    chama = db.relationship("Chama", back_populates="audit_trails")
    member = db.relationship("MemberProfile", back_populates="audit_trails")
    ledger_entry = db.relationship("LedgerEntry", back_populates="audit_trails")
