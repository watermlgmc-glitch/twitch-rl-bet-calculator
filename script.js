let tournamentData = null;
let currentRound = 0;
let isEliminated = false;
let currentTournamentId = null;

const API_BASE_URL = window.location.origin;

const skillMultipliers = {
    \'bronze\': 0.30,
    \'silver\': 0.35,
    \'gold\': 0.45,
    \'platinum\': 0.55,
    \'diamond\': 0.65
};

function calculateRounds(playerCount) {
    return Math.ceil(Math.log2(playerCount));
}

async function calculateWinChances(playerCount, skillLevel) {
    const rounds = calculateRounds(playerCount);
    const baseChance = skillMultipliers[skillLevel];
    const chances = [];
    
    let remainingPlayers = playerCount;
    
    // Lade das Performance-Modell vom Backend
    const performanceModel = await loadPerformanceModel();

    for (let i = 1; i <= rounds; i++) {
        const roundDifficulty = 1 - (i / (rounds + 2));
        let roundChance = baseChance * roundDifficulty;

        // Passe die Gewinnchance basierend auf dem Performance-Modell an
        if (performanceModel && performanceModel[skillLevel]) {
            const historicalAvgRound = performanceModel[skillLevel];
            const expectedProgress = i / rounds;
            const historicalProgress = historicalAvgRound / rounds;
            
            // Wenn der Spieler in der Vergangenheit besser abgeschnitten hat als erwartet,
            // erhöhe die Gewinnchance leicht.
            if (historicalProgress > expectedProgress) {
                roundChance *= 1.1; // 10% Bonus
            }
        }

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

function getRoundName(round, totalRounds) {
    const roundsFromEnd = totalRounds - round;
    
    if (roundsFromEnd === 0) return \'Finale\';
    if (roundsFromEnd === 1) return \'Halbfinale\';
    if (roundsFromEnd === 2) return \'Viertelfinale\';
    if (roundsFromEnd === 3) return \'Achtelfinale\';
    
    return `Runde ${round}`;
}

function calculateOverallWinChance(chances) {
    if (chances.length === 0) return 0;
    
    let overallChance = 1;
    for (let chance of chances) {
        if (chance.isActive) {
            overallChance *= (chance.winChance / 100);
        } else {
            overallChance = 0;
            break;
        }
    }
    
    return Math.round(overallChance * 1000) / 10;
}

function getChanceClass(chance) {
    if (chance >= 40) return \'high\';
    if (chance >= 20) return \'medium\';
    return \'low\';
}

async function saveTournamentToDatabase(playerCount, gameMode, skillLevel, rounds) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/tournaments`, {
            method: \'POST\',
            headers: {
                \'Content-Type\': \'application/json\',
            },
            body: JSON.stringify({
                player_count: playerCount,
                game_mode: gameMode,
                skill_level: skillLevel,
                rounds: rounds,
            })
        });
        
        if (!response.ok) {
            throw new Error(\'Fehler beim Speichern des Turniers\');
        }
        
        const data = await response.json();
        return data.tournament_id;
    } catch (error) {
        console.error(\'Fehler beim Speichern:\', error);
        return null;
    }
}

async function updateTournamentInDatabase(tournamentId, currentRound, isEliminated, rounds) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/tournaments/${tournamentId}`, {
            method: \'PUT\',
            headers: {
                \'Content-Type\': \'application/json\',
            },
            body: JSON.stringify({
                current_round: currentRound,
                is_eliminated: isEliminated,
                rounds: rounds
            })
        });
        
        if (!response.ok) {
            throw new Error(\'Fehler beim Aktualisieren des Turniers\');
        }
        
        return true;
    } catch (error) {
        console.error(\'Fehler beim Aktualisieren:\', error);
        return false;
    }
}

async function loadStatistics() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/statistics`);
        
        if (!response.ok) {
            throw new Error(\'Fehler beim Laden der Statistiken\');
        }
        
        const stats = await response.json();
        displayGlobalStatistics(stats);
    } catch (error) {
        console.error(\'Fehler beim Laden der Statistiken:\', error);
    }
}

async function loadPerformanceModel() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/statistics`);
        if (!response.ok) {
            return null;
        }
        const stats = await response.json();
        return stats.performance_model;
    } catch (error) {
        console.error(\'Fehler beim Laden des Performance-Modells:\', error);
        return null;
    }
}

function displayGlobalStatistics(stats) {
    console.log(\'Globale Statistiken:\', stats);
}

function renderResults(chances) {
    const container = document.getElementById(\'resultsContainer\');
    container.innerHTML = \'\';
    
    chances.forEach((chanceData, index) => {
        const roundDiv = document.createElement(\'div\');
        roundDiv.className = \'round-item\';
        if (!chanceData.isActive) {
            roundDiv.style.opacity = \'0.4\';
        }
        
        roundDiv.innerHTML = `
            <div class=\"round-info\">
                <div class=\"round-name\">${chanceData.roundName}</div>
                <div class=\"round-details\">${chanceData.playersRemaining} Spieler verbleibend</div>
                <div class=\"progress-bar\">
                    <div class=\"progress-fill\" style=\"width: ${chanceData.isActive ? chanceData.winChance : 0}%\"></div>
                </div>
            </div>
            <div class=\"round-chance\">
                <span class=\"chance-value ${getChanceClass(chanceData.winChance)}\">
                    ${chanceData.isActive ? chanceData.winChance : 0}%
                </span>
                <span class=\"chance-label\">Gewinnchance</span>
            </div>
        `;
        
        container.appendChild(roundDiv);
    });
}

function renderStats(chances) {
    const totalRounds = chances.length;
    const overallChance = calculateOverallWinChance(chances);
    
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
    
    document.getElementById(\'totalRounds\').textContent = totalRounds;
    document.getElementById(\'overallWinChance\').textContent = `${overallChance}%`;
    document.getElementById(\'bestRound\').textContent = `${bestRound.roundName} (${bestRound.winChance}%)`;
    document.getElementById(\'hardestRound\').textContent = `${hardestRound.roundName} (${hardestRound.winChance}%)`;
}

function renderTracking(chances) {
    const container = document.getElementById(\'trackingContainer\');
    container.innerHTML = \'\';
    
    chances.forEach((chanceData, index) => {
        const trackingDiv = document.createElement(\'div\');
        trackingDiv.className = \'tracking-round\';
        
        if (index === currentRound && !isEliminated) {
            trackingDiv.classList.add(\'active\');
        }
        
        if (index < currentRound && !isEliminated) {
            trackingDiv.classList.add(\'won\');
        }
        
        if (isEliminated && index >= currentRound) {
            trackingDiv.classList.add(\'eliminated\');
        }
        
        const buttonsHTML = (index === currentRound && !isEliminated) ? `
            <div class=\"tracking-buttons\">
                <button class=\"btn-secondary btn-success\" onclick=\"markRoundWon(${index})\">✓ Gewonnen</button>
                <button class=\"btn-secondary btn-danger\" onclick=\"markRoundLost(${index})\">✗ Verloren</button>
            </div>
        ` : \'\';
        
        const statusText = isEliminated && index >= currentRound ? 
            \'<span>Ausgeschieden</span>\' :
            index < currentRound ? 
            \'<span>Gewonnen</span>\' :
            index === currentRound && !isEliminated ?
            \'<span>Aktuelle Runde</span>\' :
            \'<span>Ausstehend</span>\';
        
        trackingDiv.innerHTML = `
            <div>
                <div class=\"round-name\">${chanceData.roundName}</div>
                <div class=\"round-details\">${statusText}</div>
            </div>
            ${buttonsHTML}
        `;
        
        container.appendChild(trackingDiv);
    });
    
    if (currentRound > 0 || isEliminated) {
        const resetDiv = document.createElement(\'div\');
        resetDiv.style.marginTop = \'1rem\';
        resetDiv.innerHTML = \'<button class=\"btn-primary\" onclick=\"resetTracking()\">Tracking zurücksetzen</button>\';
        container.appendChild(resetDiv);
    }
}

async function markRoundWon(roundIndex) {
    if (roundIndex !== currentRound || isEliminated) return;
    
    currentRound++;
    
    if (currentRound >= tournamentData.length) {
        alert(\'🎉 Glückwunsch! Ben hat das Turnier gewonnen! 🏆\');
        currentRound = tournamentData.length;
    }
    
    if (currentTournamentId) {
        await updateTournamentInDatabase(currentTournamentId, currentRound, isEliminated, tournamentData);
    }
    
    updateDisplay();
}

async function markRoundLost(roundIndex) {
    if (roundIndex !== currentRound || isEliminated) return;
    
    isEliminated = true;
    
    for (let i = currentRound; i < tournamentData.length; i++) {
        tournamentData[i].isActive = false;
        tournamentData[i].winChance = 0;
    }
    
    if (currentTournamentId) {
        await updateTournamentInDatabase(currentTournamentId, currentRound, isEliminated, tournamentData);
    }
    
    updateDisplay();
}

function resetTracking() {
    currentRound = 0;
    isEliminated = false;
    
    for (let round of tournamentData) {
        round.isActive = true;
    }
    
    if (currentTournamentId) {
        updateTournamentInDatabase(currentTournamentId, currentRound, isEliminated, tournamentData);
    }
    
    updateDisplay();
}

function updateDisplay() {
    renderResults(tournamentData);
    renderStats(tournamentData);
    renderTracking(tournamentData);
}

// Event Listener
document.addEventListener(\'DOMContentLoaded\', () => {
    const calculateButton = document.getElementById(\'calculateButton\');
    const saveButton = document.getElementById(\'saveButton\');

    calculateButton.addEventListener(\'click\', async () => {
        const playerCount = parseInt(document.getElementById(\'playerCount\').value);
        const gameMode = document.getElementById(\'gameMode\').value;
        const skillLevel = document.getElementById(\'skillLevel\').value;

        if (isNaN(playerCount) || playerCount < 2) {
            alert(\'Bitte geben Sie eine gültige Teilnehmerzahl ein (mindestens 2).\');
            return;
        }

        tournamentData = await calculateWinChances(playerCount, skillLevel);
        currentRound = 0;
        isEliminated = false;
        
        updateDisplay();
        
        document.getElementById(\'results\').style.display = \'block\';
        document.getElementById(\'tracking\').style.display = \'block\';
    });

    saveButton.addEventListener(\'click\', async () => {
        if (!tournamentData) {
            alert(\'Bitte berechnen Sie zuerst die Gewinnchancen.\');
            return;
        }

        const playerCount = parseInt(document.getElementById(\'playerCount\').value);
        const gameMode = document.getElementById(\'gameMode\').value;
        const skillLevel = document.getElementById(\'skillLevel\').value;

        currentTournamentId = await saveTournamentToDatabase(playerCount, gameMode, skillLevel, tournamentData);

        if (currentTournamentId) {
            alert(\'Turnier erfolgreich gespeichert!\');
        } else {
            alert(\'Fehler beim Speichern des Turniers.\');
        }
    });

    // Lade globale Statistiken beim Start
    loadStatistics();
});
