"""add chama creation requests

Revision ID: 8d4c1f7a2b90
Revises: 32c0bd577940
Create Date: 2026-07-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8d4c1f7a2b90'
down_revision = '32c0bd577940'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'chama_creation_requests',
        sa.Column('requested_by', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('chama_type', sa.String(length=50), nullable=False),
        sa.Column('default_contribution_amount', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('creator_role', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('approved_by', sa.String(length=36), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['requested_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    with op.batch_alter_table('audit_trails', schema=None) as batch_op:
        batch_op.alter_column('chama_id', existing_type=sa.String(length=36), nullable=True)


def downgrade():
    with op.batch_alter_table('audit_trails', schema=None) as batch_op:
        batch_op.alter_column('chama_id', existing_type=sa.String(length=36), nullable=False)

    op.drop_table('chama_creation_requests')