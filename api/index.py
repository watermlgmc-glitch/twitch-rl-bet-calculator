from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

# Globale Variable für den MongoDB Client, um die Wiederverwendung in Serverless-Umgebungen zu ermöglichen
mongo_client = None

def get_db():
    """Verbindung zur MongoDB herstellen und wiederverwenden"""
    global mongo_client
    
    mongodb_uri = os.environ.get("MONGODB_URI")
    if not mongodb_uri:
        print("ERROR: MONGODB_URI environment variable not set.")
        return None
    
    if mongo_client is None:
        try:
            mongo_client = MongoClient(mongodb_uri)
            mongo_client.admin.command("ping") 
            print("MongoDB Client initialized successfully.")
        except Exception as e:
            print(f"ERROR: Failed to initialize MongoDB client: {e}")
            mongo_client = None
            return None
    
    if mongo_client:
        return mongo_client["twitch_bet_calculator"]
    return None

@app.route("/api/statistics", methods=["GET"])
def get_statistics():
    """Globale Statistiken und Performance-Modell abrufen"""
    try:
        db = get_db()
        if not db:
            print("ERROR: Database not configured in get_statistics.")
            return jsonify({"error": "Database not configured"}), 500
        
        total_tournaments = db.tournaments.count_documents({})
        tournaments_won = db.tournaments.count_documents({"is_eliminated": False, "current_round": {"$gt": 0}})
        tournaments_lost = db.tournaments.count_documents({"is_eliminated": True})
        
        # Durchschnittliche erreichte Runde
        pipeline_avg_round = [
            {"$group": {
                "_id": None,
                "avg_round": {"$avg": "$current_round"}
            }}
        ]
        avg_result = list(db.tournaments.aggregate(pipeline_avg_round))
        avg_round = avg_result[0]["avg_round"] if avg_result and "avg_round" in avg_result[0] else 0

        # Performance-Modell: Durchschnittliche erreichte Runde pro Skill-Level
        pipeline_performance = [
            {"$group": {
                "_id": "$skill_level",
                "avg_round_reached": {"$avg": "$current_round"}
            }}
        ]
        performance_results = list(db.tournaments.aggregate(pipeline_performance))
        performance_model = {item["_id"]: item["avg_round_reached"] for item in performance_results}
        
        stats = {
            "total_tournaments": total_tournaments,
            "tournaments_won": tournaments_won,
            "tournaments_lost": tournaments_lost,
            "average_round_reached": round(avg_round, 2),
            "performance_model": performance_model
        }
        
        return jsonify(stats), 200
    except Exception as e:
        print(f"ERROR in get_statistics: {e}")
        return jsonify({"error": "Fehler beim Abrufen der Statistiken: " + str(e)}), 500

@app.route("/api/health", methods=["GET"])
def health_check():
    """Health Check Endpoint"""
    return jsonify({"status": "ok", "message": "API is running"}), 200

# For Vercel Serverless Functions, we typically expose the 'app' directly
# Vercel's Python runtime will automatically detect the 'app' variable as the WSGI application.

@app.route("/api/tournaments", methods=["POST"])
def save_tournament():
    """Speichert die Turnierdaten in MongoDB"""
    try:
        db = get_db()
        if not db:
            print("ERROR: Database not configured in save_tournament.")
            return jsonify({"error": "Database not configured"}), 500

        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON data"}), 400

        player_count = data.get("player_count")
        game_mode = data.get("game_mode")
        skill_level = data.get("skill_level")
        rounds_data = data.get("rounds")

        if not all([player_count, game_mode, skill_level, rounds_data]):
            return jsonify({"error": "Missing data for tournament"}), 400

        tournament_entry = {
            "player_count": player_count,
            "game_mode": game_mode,
            "skill_level": skill_level,
            "rounds_data": rounds_data,
            "created_at": datetime.utcnow(),
            "current_round": 0,
            "is_eliminated": False
        }

        result = db.tournaments.insert_one(tournament_entry)
        return jsonify({"message": "Tournament saved successfully", "tournament_id": str(result.inserted_id)}), 201

    except Exception as e:
        print(f"ERROR in save_tournament: {e}")
        return jsonify({"error": "Fehler beim Speichern des Turniers: " + str(e)}), 500

@app.route("/api/tournaments/<tournament_id>", methods=["PUT"])
def update_tournament(tournament_id):
    """Aktualisiert den Fortschritt eines Turniers in MongoDB"""
    try:
        db = get_db()
        if not db:
            print("ERROR: Database not configured in update_tournament.")
            return jsonify({"error": "Database not configured"}), 500

        from bson.objectid import ObjectId
        
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON data"}), 400

        current_round = data.get("current_round")
        is_eliminated = data.get("is_eliminated")
        rounds_data = data.get("rounds") # This should be the updated tournamentData

        if current_round is None or is_eliminated is None or rounds_data is None:
            return jsonify({"error": "Missing data for tournament update"}), 400

        update_fields = {
            "current_round": current_round,
            "is_eliminated": is_eliminated,
            "rounds_data": rounds_data,
            "updated_at": datetime.utcnow()
        }

        result = db.tournaments.update_one(
            {"_id": ObjectId(tournament_id)},
            {"$set": update_fields}
        )

        if result.matched_count == 0:
            return jsonify({"error": "Tournament not found"}), 404

        return jsonify({"message": "Tournament updated successfully"}), 200

    except Exception as e:
        print(f"ERROR in update_tournament: {e}")
        return jsonify({"error": "Fehler beim Aktualisieren des Turniers: " + str(e)}), 500
