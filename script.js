// Globale Variablen
let tournamentData = null;
let currentRound = 0;
let isEliminated = false;

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
        // Berechne die Schwierigkeit basierend auf der Runde
        // Je weiter im Turnier, desto schwieriger (stärkere Gegner)
        const roundDifficulty = 1 - (i / (rounds + 2)); // Schwierigkeit steigt
        
        // Gewinnchance sinkt mit jeder Runde
        const roundChance = baseChance * roundDifficulty;
        
        // Stelle sicher, dass die Chance zwischen 5% und 95% liegt
        const finalChance = Math.max(5, Math.min(95, roundChance * 100));
        
        chances.push({
            round: i,
            roundName: getRoundName(i, rounds),
            playersRemaining: remainingPlayers,
            winChance: Math.round(finalChance * 10) / 10, // Runde auf 1 Dezimalstelle
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

// Berechne die Gesamtgewinnchance (Wahrscheinlichkeit, das gesamte Turnier zu gewinnen)
function calculateOverallWinChance(chances) {
    if (chances.length === 0) return 0;
    
    // Multipliziere alle Gewinnchancen (als Dezimalzahlen)
    let overallChance = 1;
    for (let chance of chances) {
        if (chance.isActive) {
            overallChance *= (chance.winChance / 100);
        } else {
            overallChance = 0;
            break;
        }
    }
    
    return Math.round(overallChance * 1000) / 10; // In Prozent, 1 Dezimalstelle
}

// Bestimme die Farbe basierend auf der Gewinnchance
function getChanceClass(chance) {
    if (chance >= 40) return 'high';
    if (chance >= 20) return 'medium';
    return 'low';
}

// Rendere die Ergebnisse
function renderResults(chances) {
    const container = document.getElementById('resultsContainer');
    container.innerHTML = '';
    
    chances.forEach((chanceData, index) => {
        const roundDiv = document.createElement('div');
        roundDiv.className = 'round-item';
        if (!chanceData.isActive) {
            roundDiv.style.opacity = '0.4';
        }
        
        roundDiv.innerHTML = `
            <div class="round-info">
                <div class="round-name">${chanceData.roundName}</div>
                <div class="round-details">${chanceData.playersRemaining} Spieler verbleibend</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${chanceData.isActive ? chanceData.winChance : 0}%"></div>
                </div>
            </div>
            <div class="round-chance">
                <span class="chance-value ${getChanceClass(chanceData.winChance)}">
                    ${chanceData.isActive ? chanceData.winChance : 0}%
                </span>
                <span class="chance-label">Gewinnchance</span>
            </div>
        `;
        
        container.appendChild(roundDiv);
    });
}

// Rendere die Statistiken
function renderStats(chances) {
    const totalRounds = chances.length;
    const overallChance = calculateOverallWinChance(chances);
    
    // Finde beste und schwerste Runde
    let bestRound = chances[0];
    let hardestRound = chances[chances.length - 1];
    
    for (let chance of chances) {
        if (chance.isActive && chance.winChance > bestRound.winChance) {
            bestRound = chance;
        }
        if (chance.isActive && chance.winChance < hardestRound.winChance) {
            hardestRound = chance;
        }
    }
    
    document.getElementById('totalRounds').textContent = totalRounds;
    document.getElementById('overallWinChance').textContent = `${overallChance}%`;
    document.getElementById('bestRound').textContent = `${bestRound.roundName} (${bestRound.winChance}%)`;
    document.getElementById('hardestRound').textContent = `${hardestRound.roundName} (${hardestRound.winChance}%)`;
}

// Rendere das Tracking-Interface
function renderTracking(chances) {
    const container = document.getElementById('trackingContainer');
    container.innerHTML = '';
    
    chances.forEach((chanceData, index) => {
        const trackingDiv = document.createElement('div');
        trackingDiv.className = 'tracking-round';
        
        // Markiere die aktuelle Runde
        if (index === currentRound && !isEliminated) {
            trackingDiv.classList.add('active');
        }
        
        // Markiere gewonnene Runden
        if (index < currentRound && !isEliminated) {
            trackingDiv.classList.add('won');
        }
        
        // Markiere, wenn eliminiert
        if (isEliminated && index >= currentRound) {
            trackingDiv.classList.add('eliminated');
        }
        
        const buttonsHTML = (index === currentRound && !isEliminated) ? `
            <div class="tracking-buttons">
                <button class="btn-secondary btn-success" onclick="markRoundWon(${index})">✓ Gewonnen</button>
                <button class="btn-secondary btn-danger" onclick="markRoundLost(${index})">✗ Verloren</button>
            </div>
        ` : '';
        
        const statusText = isEliminated && index >= currentRound ? 
            '<span style="color: var(--danger)">Ausgeschieden</span>' :
            index < currentRound ? 
            '<span style="color: var(--success)">Gewonnen</span>' :
            index === currentRound && !isEliminated ?
            '<span style="color: var(--warning)">Aktuelle Runde</span>' :
            '<span style="color: var(--text-secondary)">Ausstehend</span>';
        
        trackingDiv.innerHTML = `
            <div>
                <div class="round-name">${chanceData.roundName}</div>
                <div class="round-details">${statusText}</div>
            </div>
            ${buttonsHTML}
        `;
        
        container.appendChild(trackingDiv);
    });
    
    // Reset-Button hinzufügen
    if (currentRound > 0 || isEliminated) {
        const resetDiv = document.createElement('div');
        resetDiv.style.marginTop = '1rem';
        resetDiv.innerHTML = '<button class="btn-primary" onclick="resetTracking()">Tracking zurücksetzen</button>';
        container.appendChild(resetDiv);
    }
}

// Markiere eine Runde als gewonnen
function markRoundWon(roundIndex) {
    if (roundIndex !== currentRound || isEliminated) return;
    
    currentRound++;
    
    // Wenn alle Runden gewonnen wurden
    if (currentRound >= tournamentData.length) {
        alert('🎉 Glückwunsch! Ben hat das Turnier gewonnen! 🏆');
        currentRound = tournamentData.length;
    }
    
    updateDisplay();
}

// Markiere eine Runde als verloren (Elimination)
function markRoundLost(roundIndex) {
    if (roundIndex !== currentRound || isEliminated) return;
    
    isEliminated = true;
    
    // Setze alle nachfolgenden Runden auf inaktiv
    for (let i = currentRound; i < tournamentData.length; i++) {
        tournamentData[i].isActive = false;
        tournamentData[i].winChance = 0;
    }
    
    updateDisplay();
    
    alert(`Ben ist in ${tournamentData[roundIndex].roundName} ausgeschieden. Alle nachfolgenden Gewinnchancen wurden auf 0% gesetzt.`);
}

// Setze das Tracking zurück
function resetTracking() {
    currentRound = 0;
    isEliminated = false;
    
    // Reaktiviere alle Runden
    const playerCount = parseInt(document.getElementById('playerCount').value);
    const skillLevel = document.getElementById('benSkill').value;
    
    tournamentData = calculateWinChances(playerCount, skillLevel);
    
    updateDisplay();
}

// Aktualisiere die Anzeige
function updateDisplay() {
    if (!tournamentData) return;
    
    renderResults(tournamentData);
    renderStats(tournamentData);
    renderTracking(tournamentData);
}

// Hauptberechnung
function calculate() {
    const playerCount = parseInt(document.getElementById('playerCount').value);
    const gameMode = document.getElementById('gameMode').value;
    const skillLevel = document.getElementById('benSkill').value;
    
    // Validierung
    if (!playerCount || playerCount < 2) {
        alert('Bitte gib eine gültige Anzahl von Teilnehmern ein (mindestens 2).');
        return;
    }
    
    // Berechne Gewinnchancen
    tournamentData = calculateWinChances(playerCount, skillLevel);
    
    // Setze Tracking zurück
    currentRound = 0;
    isEliminated = false;
    
    // Aktualisiere Anzeige
    updateDisplay();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    const calculateBtn = document.getElementById('calculateBtn');
    calculateBtn.addEventListener('click', calculate);
    
    // Enter-Taste in Eingabefeldern
    document.getElementById('playerCount').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            calculate();
        }
    });
});

