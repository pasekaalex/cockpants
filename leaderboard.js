// Supabase Leaderboard System
// This file handles all leaderboard operations

const SUPABASE_URL = 'https://qzjosbzyblhtbajwccyh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6am9zYnp5YmxodGJhandjY3loIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyODM0MjYsImV4cCI6MjA3OTg1OTQyNn0.lbJN01m_ORWquZ-P0Lkb_K1izmMjQduvO_m7qUVlLsk';

// Initialize Supabase client (loaded from CDN in HTML)
let supabase = null;

// Wait for Supabase to load and initialize it
function waitForSupabase() {
  return new Promise((resolve) => {
    if (typeof window.supabase !== 'undefined') {
      if (!supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase initialized');
      }
      resolve(supabase);
    } else {
      console.log('⏳ Waiting for Supabase library to load...');
      setTimeout(() => {
        if (typeof window.supabase !== 'undefined') {
          if (!supabase) {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('✅ Supabase initialized (after wait)');
          }
          resolve(supabase);
        } else {
          console.error('❌ Supabase library not found');
          resolve(null);
        }
      }, 500);
    }
  });
}

function initSupabase() {
  if (typeof window.supabase !== 'undefined' && !supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabase;
}

// Format large numbers for display (K, M, B, T, Q, etc.)
function formatLargeScore(n) {
  if (n >= 1e18) return (n / 1e18).toFixed(2) + 'Qi'; // Quintillion
  if (n >= 1e15) return (n / 1e15).toFixed(2) + 'Q';  // Quadrillion
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';  // Trillion
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';    // Billion
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';    // Million
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';    // Thousand
  return Math.floor(n).toLocaleString();
}

// Safely handle very large scores for database storage
// PostgreSQL BIGINT max is ~9.2 quintillion, but JS Number.MAX_SAFE_INTEGER is ~9 quadrillion
function sanitizeScoreForDB(score) {
  // Cap at MAX_SAFE_INTEGER to prevent precision loss
  const MAX_SAFE = Number.MAX_SAFE_INTEGER; // 9,007,199,254,740,991
  if (score > MAX_SAFE) {
    console.warn(`Score ${score} exceeds MAX_SAFE_INTEGER, capping at ${MAX_SAFE}`);
    return MAX_SAFE;
  }
  return Math.floor(score);
}

// Submit a score to the leaderboard
async function submitScore(gameName, playerName, score) {
  try {
    console.log('🎯 submitScore called with:', gameName, playerName, score);
    
    // Sanitize the score to prevent database/precision issues
    const safeScore = sanitizeScoreForDB(score);
    console.log('📊 Sanitized score:', safeScore);
    
    const client = await waitForSupabase();
    console.log('📊 Client after init:', client ? 'READY' : 'NULL');
    if (!client) {
      console.error('❌ Supabase not loaded');
      return { success: false, error: 'Supabase not initialized' };
    }

    // First check if this player already has a score for this game
    const { data: existingScores, error: fetchError } = await client
      .from('leaderboards')
      .select('*')
      .eq('game_name', gameName)
      .eq('player_name', playerName);

    if (fetchError) {
      console.error('Error checking existing scores:', fetchError);
    }

    // If player has existing score(s), check if new score is better
    if (existingScores && existingScores.length > 0) {
      const bestExisting = Math.max(...existingScores.map(s => s.score));
      
      if (safeScore > bestExisting) {
        // New score is better! Delete old scores and insert new one
        const { error: deleteError } = await client
          .from('leaderboards')
          .delete()
          .eq('game_name', gameName)
          .eq('player_name', playerName);
        
        if (deleteError) {
          console.error('Error deleting old scores:', deleteError);
          return { success: false, error: deleteError };
        }
      } else {
        // Existing score is better, don't submit
        return { 
          success: true, 
          message: 'Existing score is higher',
          isNewBest: false 
        };
      }
    }

    // Insert the new score
    const { data, error } = await client
      .from('leaderboards')
      .insert([
        {
          game_name: gameName,
          player_name: playerName,
          score: safeScore
        }
      ]);

    if (error) {
      console.error('Error submitting score:', error);
      return { success: false, error };
    }

    return { success: true, data, isNewBest: true };
  } catch (err) {
    console.error('Exception submitting score:', err);
    return { success: false, error: err };
  }
}

// Get top N scores for a specific game
async function getLeaderboard(gameName, limit = 10) {
  try {
    const client = await waitForSupabase();
    if (!client) {
      console.error('Supabase not loaded');
      return { success: false, error: 'Supabase not initialized', data: [] };
    }

    const { data, error } = await client
      .from('leaderboards')
      .select('*')
      .eq('game_name', gameName)
      .order('score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return { success: false, error, data: [] };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    console.error('Exception fetching leaderboard:', err);
    return { success: false, error: err, data: [] };
  }
}

// Get all leaderboards (for global leaderboard page)
async function getAllLeaderboards() {
  try {
    const client = await waitForSupabase();
    if (!client) {
      return { success: false, data: {} };
    }

    const games = [
      'pump-clicker',
      'flappy-cock',
      'plankton-heist',
      'boating-school',
      'bikini-adventure',
      'jellyfish-fields',
      'patrick-friendship',
      'house-hoarder',
      'krusty-krab-rush',
      'krusty-tycoon'
    ];

    const leaderboards = {};

    for (const game of games) {
      const result = await getLeaderboard(game, 5);
      if (result.success) {
        leaderboards[game] = result.data;
      }
    }

    return { success: true, data: leaderboards };
  } catch (err) {
    console.error('Exception fetching all leaderboards:', err);
    return { success: false, data: {} };
  }
}

// Show leaderboard modal
function showLeaderboardModal(gameName, gameTitle, playerScore = null) {
  // Format the player score for display
  let displayPlayerScore = playerScore;
  if (playerScore !== null) {
    if (gameName === 'pump-clicker' && playerScore >= 1e9) {
      displayPlayerScore = formatLargeScore(playerScore);
    } else if (gameName && gameName.startsWith('plankton-heist-level')) {
      displayPlayerScore = `${10000 - playerScore}s`;
    } else {
      displayPlayerScore = playerScore.toLocaleString();
    }
  }
  
  // Create modal HTML
  const modalHTML = `
    <div id="leaderboardModal" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: 'Krabby Patty', Arial, sans-serif;
    ">
      <div style="
        background: linear-gradient(135deg, #1a1a2e, #16213e);
        border: 4px solid #FFD700;
        border-radius: 20px;
        padding: 30px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 0 50px rgba(255, 215, 0, 0.5);
      ">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="
            color: #FFD700;
            font-size: 32px;
            text-shadow: 3px 3px 0 #000;
            margin: 0 0 10px 0;
          ">🏆 LEADERBOARD 🏆</h2>
          <p style="color: #fff; font-size: 18px; margin: 0;">${gameTitle}</p>
        </div>

        ${playerScore !== null ? `
          <div id="nameSubmitSection" style="margin-bottom: 20px;">
            <p style="color: #FFD700; text-align: center; font-size: 18px; margin-bottom: 15px;">
              Your Score: <strong>${displayPlayerScore}</strong>
            </p>
            <input 
              type="text" 
              id="playerNameInput" 
              placeholder="Enter your name" 
              maxlength="20"
              value="${gameName === 'pump-clicker' ? (localStorage.getItem('clickerUsername') || '') : ''}"
              style="
                width: 100%;
                padding: 12px;
                font-size: 16px;
                border: 3px solid #FFD700;
                border-radius: 10px;
                background: rgba(255, 255, 255, 0.9);
                font-family: 'Krabby Patty', Arial, sans-serif;
                margin-bottom: 10px;
                box-sizing: border-box;
              "
            />
            <button 
              onclick="submitLeaderboardScore('${gameName}', ${playerScore})"
              style="
                width: 100%;
                padding: 12px;
                font-size: 18px;
                background: linear-gradient(135deg, #FFD700, #FFA500);
                border: 3px solid #fff;
                border-radius: 10px;
                color: #000;
                font-weight: bold;
                cursor: pointer;
                font-family: 'Krabby Patty', Arial, sans-serif;
              "
            >SUBMIT SCORE</button>
          </div>
        ` : ''}

        <div id="leaderboardContent" style="
          background: rgba(0, 0, 0, 0.5);
          border: 2px solid #FFD700;
          border-radius: 10px;
          padding: 15px;
          margin-bottom: 20px;
        ">
          <p style="color: #fff; text-align: center;">Loading...</p>
        </div>

        <button 
          onclick="closeLeaderboardModal()"
          style="
            width: 100%;
            padding: 12px;
            font-size: 18px;
            background: rgba(139, 69, 19, 0.8);
            border: 3px solid #8B4513;
            border-radius: 10px;
            color: #FFD700;
            font-weight: bold;
            cursor: pointer;
            font-family: 'Krabby Patty', Arial, sans-serif;
          "
        >CLOSE</button>
      </div>
    </div>
  `;

  // Add to page
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Load leaderboard data
  loadLeaderboardData(gameName);
}

// Load and display leaderboard data
async function loadLeaderboardData(gameName) {
  const content = document.getElementById('leaderboardContent');
  
  const result = await getLeaderboard(gameName, 10);
  
  if (result.success && result.data.length > 0) {
    let html = '<div style="color: #fff;">';
    
    result.data.forEach((entry, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      const bgColor = index < 3 ? 'rgba(255, 215, 0, 0.2)' : 'transparent';
      
      // Format score display based on game type
      let displayScore;
      if (gameName && gameName.startsWith('plankton-heist-level')) {
        // Plankton heist shows time
        const timeInSeconds = 10000 - entry.score;
        displayScore = `${timeInSeconds}s`;
      } else if (gameName === 'pump-clicker' && entry.score >= 1e9) {
        // Pump clicker with billion+ scores gets special formatting
        displayScore = formatLargeScore(entry.score);
      } else {
        displayScore = entry.score.toLocaleString();
      }
      
      html += `
        <div style="
          display: flex;
          justify-content: space-between;
          padding: 10px;
          margin: 5px 0;
          background: ${bgColor};
          border-radius: 5px;
        ">
          <span style="font-weight: bold;">${medal} ${entry.player_name}</span>
          <span style="color: #FFD700;">${displayScore}</span>
        </div>
      `;
    });
    
    html += '</div>';
    content.innerHTML = html;
  } else {
    content.innerHTML = '<p style="color: #aaa; text-align: center;">No scores yet. Be the first!</p>';
  }
}

// Submit score from modal
window.submitLeaderboardScore = async function(gameName, score) {
  const nameInput = document.getElementById('playerNameInput');
  const playerName = nameInput.value.trim();
  
  if (!playerName) {
    alert('Please enter your name!');
    return;
  }
  
  // Disable submit button
  const submitBtn = event.target;
  submitBtn.disabled = true;
  submitBtn.textContent = 'SUBMITTING...';
  
  // Submit score
  try {
    const result = await submitScore(gameName, playerName, score);
    console.log('📝 Result from submitScore:', result);
    
    if (!result) {
      console.error('❌ No result returned from submitScore');
      alert('Error: No response from leaderboard system');
      submitBtn.disabled = false;
      submitBtn.textContent = 'SUBMIT SCORE';
      return;
    }
  
    if (result.success) {
    // Save username for pump clicker auto-update
    if (gameName === 'pump-clicker') {
      localStorage.setItem('clickerUsername', playerName);
    }
    
    // Hide name input section with appropriate message
    const message = result.isNewBest !== false 
      ? '✔ Score submitted successfully!' 
      : '✔ Your previous score was higher!';
    const color = result.isNewBest !== false ? '#00ff00' : '#FFD700';
    
    document.getElementById('nameSubmitSection').innerHTML = `
      <p style="color: ${color}; text-align: center; font-size: 18px;">
        ${message}
      </p>
    `;
    
      // Reload leaderboard
      loadLeaderboardData(gameName);
    } else {
      alert('Error submitting score. Please try again!');
      submitBtn.disabled = false;
      submitBtn.textContent = 'SUBMIT SCORE';
    }
  } catch (err) {
    console.error('❌ Exception in submitLeaderboardScore:', err);
    alert('Error submitting score: ' + err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'SUBMIT SCORE';
  }
};

// Close modal
window.closeLeaderboardModal = function() {
  const modal = document.getElementById('leaderboardModal');
  if (modal) {
    modal.remove();
  }
};

// Delete a specific player from leaderboard
window.deletePlayerFromLeaderboard = async function(gameName, playerName) {
  try {
    console.log(`🗑️ Attempting to delete ${playerName} from ${gameName} leaderboard...`);
    const client = await waitForSupabase();
    if (!client) {
      console.error('❌ Supabase not loaded');
      alert('Error: Supabase not initialized');
      return false;
    }

    const { error } = await client
      .from('leaderboards')
      .delete()
      .eq('game_name', gameName)
      .eq('player_name', playerName);

    if (error) {
      console.error(`❌ Error deleting ${playerName}:`, error);
      alert(`Error deleting ${playerName}: ${error.message}`);
      return false;
    }

    console.log(`✅ Successfully deleted ${playerName} from ${gameName}`);
    alert(`✔ Successfully deleted ${playerName} from ${gameName} leaderboard!`);
    return true;
  } catch (err) {
    console.error('❌ Exception deleting player:', err);
    alert('Error deleting player: ' + err.message);
    return false;
  }
};