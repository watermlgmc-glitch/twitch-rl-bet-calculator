// Globale Variablen
let tournamentData = null;
let currentRound = 0;
let isEliminated = false;
let currentTournamentId = null;

// API Base URL (wird automatisch auf Vercel gesetzt)
const API_BASE_URL = window.location.origin;

// Skill-Level Multiplikatoren
const skillMultipliers = {
    'bronze': 0.30,
    'silver': 0.35,
    'gold': 0.45,      // Standard für Gold 3
    'platinum': 0.55,
    'diamond': 0.65
};

// Berechne die Anzahl der Runden basierend auf Teilnehmerzahl
function calculateRounds(playerCount) {
    return Math.ceil(Math.log2(playerCount));
}

// Berechne Gewinnchancen für jede Runde
function calculateWinChances(playerCount, skillLevel) {
    const rounds = calculateRounds(playerCount);
    const baseChance = skillMultipliers[skillLevel];
    const chances = [];
    
    let remainingPlayers = playerCount;
    
    for (let i = 1; i <= rounds; i++) {
        const roundDifficulty = 1 - (i / (rounds + 2));
        const roundChance = baseChance * roundDifficulty;
        const finalChance = Math.max(5, Math.min(95, roundChance * 100));
        
        chances.push({
            round: i,
            roundName: getRoundName(i, rounds),
            playersRemaining: remainingPlayers,
            winChance: Math.round(finalChance * 10) / 10,
            isActive: true
        });
        
        remainingPlayers = Math.ceil(remainingPlayers / 2);
    }
    
    return chances;
}

// Gib den Namen der Runde zurück
function getRoundName(round, totalRounds) {
    const roundsFromEnd = totalRounds - round;
    if (roundsFromEnd === 0) return 'Finale';
    if (roundsFromEnd === 1) return 'Halbfinale';
    if (roundsFromEnd === 2) return 'Viertelfinale';
    if (roundsFromEnd === 3) return 'Achtelfinale';
    return `Runde ${round}`;
}

// Berechne die Gesamtgewinnchance
function calculateOverallWinChance(chances) {
    if (!chances || chances.length === 0) return 0;
    let overallChance = chances.reduce((acc, chance) => acc * (chance.isActive ? chance.winChance / 100 : 0), 1);
    if (chances.some(c => !c.isActive)) overallChance = 0;
    return Math.round(overallChance * 1000) / 10;
}

// Bestimme die Farbe basierend auf der Gewinnchance
function getChanceClass(chance) {
    if (chance >= 40) return 'high';
    if (chance >= 20) return 'medium';
    return 'low';
}

// --- API Funktionen ---
async function saveTournamentToDatabase(playerCount, gameMode, skillLevel, rounds) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/tournaments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_count: playerCount, game_mode: gameMode, skill_level: skillLevel, rounds: rounds })
        });
        if (!response.ok) throw new Error(`Serverfehler: ${response.statusText}`);
        const data = await response.json();
        return data.tournament_id;
    } catch (error) {
        console.error('Fehler beim Speichern des Turniers:', error);
        return null;
    }
}

async function updateTournamentInDatabase(tournamentId, currentRound, isEliminated, rounds) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/tournaments/${tournamentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_round: currentRound, is_eliminated: isEliminated, rounds: rounds })
        });
        if (!response.ok) throw new Error(`Serverfehler: ${response.statusText}`);
        return true;
    } catch (error) {
        console.error('Fehler beim Aktualisieren des Turniers:', error);
        return false;
    }
}

async function loadGlobalStatistics() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/statistics`);
        if (!response.ok) throw new Error(`Serverfehler: ${response.statusText}`);
        const stats = await response.json();
        displayGlobalStatistics(stats);
    } catch (error) {
        console.error('Fehler beim Laden der globalen Statistiken:', error);
    }
}

// --- UI Rendering Funktionen ---
function displayGlobalStatistics(stats) {
    document.getElementById('globalTotalTournaments').textContent = stats.total_tournaments || 0;
    document.getElementById('globalTournamentsWon').textContent = stats.tournaments_won || 0;
    document.getElementById('globalTournamentsLost').textContent = stats.tournaments_lost || 0;
    document.getElementById('globalAverageRound').textContent = stats.average_round_reached || 0;
}

function renderResults(chances) {
    const container = document.getElementById('resultsContainer');
    container.innerHTML = '';
    if (!chances) return;
    chances.forEach(chanceData => {
        const roundDiv = document.createElement('div');
        roundDiv.className = 'round-item';
        if (!chanceData.isActive) roundDiv.style.opacity = '0.4';
        roundDiv.innerHTML = `
            <div class="round-info">
                <div class="round-name">${chanceData.roundName}</div>
                <div class="round-details">${chanceData.playersRemaining} Spieler verbleibend</div>
                <div class="progress-bar"><div class="progress-fill" style="width: ${chanceData.isActive ? chanceData.winChance : 0}%"></div></div>
            </div>
            <div class="round-chance">
                <span class="chance-value ${getChanceClass(chanceData.winChance)}">${chanceData.isActive ? chanceData.winChance : 0}%</span>
                <span class="chance-label">Gewinnchance</span>
            </div>`;
        container.appendChild(roundDiv);
    });
}

function renderStats(chances) {
    if (!chances) return;
    const totalRounds = chances.length;
    const overallChance = calculateOverallWinChance(chances);
    const activeRounds = chances.filter(c => c.isActive);
    const bestRound = activeRounds.length > 0 ? activeRounds.reduce((max, r) => r.winChance > max.winChance ? r : max, activeRounds[0]) : { roundName: '-', winChance: 0 };
    const hardestRound = activeRounds.length > 0 ? activeRounds.reduce((min, r) => r.winChance < min.winChance ? r : min, activeRounds[0]) : { roundName: '-', winChance: 0 };

    document.getElementById('totalRounds').textContent = totalRounds;
    document.getElementById('overallWinChance').textContent = `${overallChance}%`;
    document.getElementById('bestRound').textContent = `${bestRound.roundName} (${bestRound.winChance}%)`;
    document.getElementById('hardestRound').textContent = `${hardestRound.roundName} (${hardestRound.winChance}%)`;
}

function renderTracking(chances) {
    const container = document.getElementById('trackingContainer');
    container.innerHTML = '';
    if (!chances) return;

    const isTournamentOver = isEliminated || currentRound >= chances.length;
    const buttonsDisabled = !currentTournamentId ? 'disabled' : '';

    chances.forEach((chanceData, index) => {
        const trackingDiv = document.createElement('div');
        trackingDiv.className = 'tracking-round';
        if (index === currentRound && !isEliminated) trackingDiv.classList.add('active');
        if (index < currentRound && !isEliminated) trackingDiv.classList.add('won');
        if (isEliminated && index >= currentRound) trackingDiv.classList.add('eliminated');

        const buttonsHTML = (index === currentRound && !isEliminated) ? `
            <div class="tracking-buttons">
                <button class="btn-secondary btn-success" onclick="markRoundWon(${index})" ${buttonsDisabled}>✓ Gewonnen</button>
                <button class="btn-secondary btn-danger" onclick="markRoundLost(${index})" ${buttonsDisabled}>✗ Verloren</button>
            </div>` : '';
        
        const statusText = isEliminated && index >= currentRound ? '<span style="color: var(--danger)">Ausgeschieden</span>' :
                         index < currentRound ? '<span style="color: var(--success)">Gewonnen</span>' :
                         index === currentRound && !isEliminated ? '<span style="color: var(--warning)">Aktuelle Runde</span>' :
                         '<span style="color: var(--text-secondary)">Ausstehend</span>';

        trackingDiv.innerHTML = `<div><div class="round-name">${chanceData.roundName}</div><div class="round-details">${statusText}</div></div>${buttonsHTML}`;
        container.appendChild(trackingDiv);
    });

    const finalizeBtn = document.getElementById('finalizeTournamentBtn');
    if (currentTournamentId && isTournamentOver) {
        finalizeBtn.style.display = 'block';
    } else {
        finalizeBtn.style.display = 'none';
    }
}

// --- Event Handler & Logik ---
async function markRoundWon(roundIndex) {
    if (roundIndex !== currentRound || isEliminated) return;
    currentRound++;
    if (currentRound >= tournamentData.length) {
        alert('🎉 Glückwunsch! Ben hat das Turnier gewonnen! 🏆');
    }
    await updateTournamentInDatabase(currentTournamentId, currentRound, isEliminated, tournamentData);
    updateDisplay();
}

async function markRoundLost(roundIndex) {
    if (roundIndex !== currentRound || isEliminated) return;
    isEliminated = true;
    for (let i = currentRound; i < tournamentData.length; i++) {
        tournamentData[i].isActive = false;
        tournamentData[i].winChance = 0;
    }
    await updateTournamentInDatabase(currentTournamentId, currentRound, isEliminated, tournamentData);
    updateDisplay();
    alert(`Ben ist in ${tournamentData[roundIndex].roundName} ausgeschieden.`);
}

function resetUI() {
    tournamentData = null;
    currentTournamentId = null;
    currentRound = 0;
    isEliminated = false;

    document.getElementById('resultsContainer').innerHTML = '<p class="placeholder-text">Gib die Turnier-Einstellungen ein und klicke auf "Berechnen"</p>';
    document.getElementById('trackingContainer').innerHTML = '<p class="placeholder-text">Berechne zuerst die Gewinnchancen, um das Tracking zu starten</p>';
    document.getElementById('totalRounds').textContent = '-';
    document.getElementById('overallWinChance').textContent = '-';
    document.getElementById('bestRound').textContent = '-';
    document.getElementById('hardestRound').textContent = '-';
    document.getElementById('finalizeTournamentBtn').style.display = 'none';
}

async function calculate() {
    const playerCount = parseInt(document.getElementById('playerCount').value);
    if (!playerCount || playerCount < 2) {
        alert('Bitte gib eine gültige Anzahl von Teilnehmern ein (mindestens 2).');
        return;
    }

    resetUI();
    tournamentData = calculateWinChances(playerCount, document.getElementById('benSkill').value);
    currentTournamentId = await saveTournamentToDatabase(playerCount, document.getElementById('gameMode').value, document.getElementById('benSkill').value, tournamentData);

    if (!currentTournamentId) {
        alert('Achtung: Es konnte keine Verbindung zur Datenbank hergestellt werden. Das Turnier wird nicht gespeichert und das Tracking ist deaktiviert.');
    } else {
        console.log('Turnier erfolgreich in DB gespeichert mit ID:', currentTournamentId);
    }
    updateDisplay();
}

async function finalizeTournament() {
    if (!currentTournamentId) return;
    alert('Turnier wurde abgeschlossen und die Ergebnisse in den globalen Statistiken erfasst!');
    resetUI();
    await loadGlobalStatistics();
}

function updateDisplay() {
    renderResults(tournamentData);
    renderStats(tournamentData);
    renderTracking(tournamentData);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('calculateBtn').addEventListener('click', calculate);
    document.getElementById('finalizeTournamentBtn').addEventListener('click', finalizeTournament);
    document.getElementById('playerCount').addEventListener('keypress', e => e.key === 'Enter' && calculate());
    loadGlobalStatistics();
});
