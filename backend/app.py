import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS

from config.config import DevelopmentConfig, ProductionConfig


db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()


def create_app(config_class=None):
    app = Flask(__name__)

    if config_class is None:
        config_class = (
            DevelopmentConfig
            if os.getenv("FLASK_ENV") == "development"
            else ProductionConfig
        )

    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    CORS(app)

    @app.route("/")
    def index():
        return {"message": "ChamaPlus backend is running"}

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
