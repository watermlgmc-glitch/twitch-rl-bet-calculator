from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

# MongoDB Verbindung
def get_db():
    """Verbindung zur MongoDB herstellen"""
    mongodb_uri = os.environ.get("MONGODB_URI")
    if not mongodb_uri:
        return None
    
    client = MongoClient(mongodb_uri)
    db = client["twitch_bet_calculator"]
    return db

@app.route("/api/tournaments", methods=["GET"])
def get_tournaments():
    """Alle Turniere abrufen"""
    try:
        db = get_db()
        if not db:
            return jsonify({"error": "Database not configured"}), 500
        
        tournaments = list(db.tournaments.find({}, {"_id": 0}).sort("created_at", -1))
        return jsonify(tournaments), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/tournaments", methods=["POST"])
def create_tournament():
    """Neues Turnier erstellen"""
    try:
        db = get_db()
        if not db:
            return jsonify({"error": "Database not configured"}), 500
        
        data = request.json
        
        tournament = {
            "player_count": data.get("player_count"),
            "game_mode": data.get("game_mode"),
            "skill_level": data.get("skill_level"),
            "rounds": data.get("rounds"),
            "current_round": 0,
            "is_eliminated": False,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        result = db.tournaments.insert_one(tournament)
        tournament["tournament_id"] = str(result.inserted_id)
        del tournament["_id"]
        
        return jsonify(tournament), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/tournaments/<tournament_id>", methods=["GET"])
def get_tournament(tournament_id):
    """Einzelnes Turnier abrufen"""
    try:
        db = get_db()
        if not db:
            return jsonify({"error": "Database not configured"}), 500
        
        from bson.objectid import ObjectId
        tournament = db.tournaments.find_one({"_id": ObjectId(tournament_id)}, {"_id": 0})
        
        if not tournament:
            return jsonify({"error": "Tournament not found"}), 404
        
        return jsonify(tournament), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/tournaments/<tournament_id>", methods=["PUT"])
def update_tournament(tournament_id):
    """Turnier aktualisieren (z.B. Runde gewonnen/verloren)"""
    try:
        db = get_db()
        if not db:
            return jsonify({"error": "Database not configured"}), 500
        
        from bson.objectid import ObjectId
        data = request.json
        
        update_data = {
            "current_round": data.get("current_round"),
            "is_eliminated": data.get("is_eliminated"),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Optional: Runden-Status aktualisieren
        if "rounds" in data:
            update_data["rounds"] = data["rounds"]
        
        result = db.tournaments.update_one(
            {"_id": ObjectId(tournament_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            return jsonify({"error": "Tournament not found"}), 404
        
        return jsonify({"message": "Tournament updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/statistics", methods=["GET"])
def get_statistics():
    """Gesamtstatistiken abrufen"""
    try:
        db = get_db()
        if not db:
            return jsonify({"error": "Database not configured"}), 500
        
        total_tournaments = db.tournaments.count_documents({})
        tournaments_won = db.tournaments.count_documents({"current_round": {"$exists": True}, "is_eliminated": False})
        tournaments_lost = db.tournaments.count_documents({"is_eliminated": True})
        
        # Durchschnittliche erreichte Runde
        pipeline = [
            {"$group": {
                "_id": None,
                "avg_round": {"$avg": "$current_round"}
            }}
        ]
        avg_result = list(db.tournaments.aggregate(pipeline))
        # Sicherstellen, dass avg_result nicht leer ist und der Schlüssel existiert
        avg_round = avg_result[0]["avg_round"] if avg_result and "avg_round" in avg_result[0] else 0
        
        stats = {
            "total_tournaments": total_tournaments,
            "tournaments_won": tournaments_won,
            "tournaments_lost": tournaments_lost,
            "average_round_reached": round(avg_round, 2)
        }
        
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/health", methods=["GET"])
def health_check():
    """Health Check Endpoint"""
    return jsonify({"status": "ok", "message": "API is running"}), 200

# For Vercel Serverless Functions, we typically expose the 'app' directly
# Vercel's Python runtime will automatically detect the 'app' variable as the WSGI application.
# The previous 'handler' function is not needed if 'app' is directly exposed.
# If you need custom request handling, consider using a different approach or Vercel's own request handling mechanisms.




