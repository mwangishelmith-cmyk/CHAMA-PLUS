"""Add join_requests table and join_requests relationship to Chama.

Revision ID: 9e5f8c3a7d21
Revises: 8d4c1f7a2b90
Create Date: 2024-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9e5f8c3a7d21'
down_revision = '8d4c1f7a2b90'
branch_labels = None
depends_on = None


def upgrade():
    # Create join_requests table
    op.create_table(
        'join_requests',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('chama_id', sa.String(36), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='PENDING'),
        sa.Column('requested_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('reviewed_at', sa.DateTime, nullable=True),
        sa.Column('reviewed_by', sa.String(36), nullable=True),
        sa.Column('remarks', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['chama_id'], ['chamas.id'], ),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'chama_id', 'status', name='uq_active_join_request')
    )


def downgrade():
    # Drop join_requests table
    op.drop_table('join_requests')
