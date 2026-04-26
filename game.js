// 漢字チャレンジGO - ゲームロジック
(function () {
    "use strict";

    // ---- State ----
    const STATE = {
        currentScreen: "title",
        level: null,
        lives: 5,
        score: 0,
        streak: 0,
        bestStreak: 0,
        questionPool: [],
        currentQuestion: null,
        questionIndex: 0,
        totalQuestions: 0,
        isProcessing: false,
        timeLimit: 10.0,
        timeLeft: 10.0,
        timerId: null,
    };

    // ---- DOM References ----
    const $ = (sel) => document.querySelector(sel);
    const screens = {
        title: $("#title-screen"),
        level: $("#level-screen"),
        settings: $("#settings-screen"),
        game: $("#game-screen"),
        gameover: $("#gameover-screen"),
        clear: $("#clear-screen"),
        ranking: $("#ranking-screen"),
    };

    const dom = {
        startBtn: $("#start-btn"),
        levelBtns: document.querySelectorAll(".level-btn:not(.time-btn)"),
        settingsBtn: $("#settings-btn"),
        timeBtns: document.querySelectorAll(".time-btn"),
        settingsBackBtn: $("#settings-back-btn"),
        levelBadge: $(".level-badge"),
        scoreDisplay: $(".score-display"),
        livesDisplay: $(".lives-display"),
        streakDisplay: $(".streak-display"),
        questionCount: $(".question-count"),
        kanjiText: $(".kanji-text"),
        answerInput: $("#answer-input"),
        testInput: $("#test-input"),
        submitBtn: $("#submit-btn"),
        feedbackMessage: $(".feedback-message"),
        screenFlash: $(".screen-flash"),
        timerBar: $("#timer-bar"),
        timerText: $("#timer-text"),
        // Game Over
        goScore: $("#go-score"),
        goHighscore: $("#go-highscore"),
        goStreak: $("#go-best-streak"),
        goNewHighscore: $("#go-new-highscore"),
        retryBtn: $("#retry-btn"),
        goTitleBtn: $("#go-title-btn"),
        // Clear
        clScore: $("#cl-score"),
        clHighscore: $("#cl-highscore"),
        clStreak: $("#cl-best-streak"),
        clNewHighscore: $("#cl-new-highscore"),
        clRetryBtn: $("#cl-retry-btn"),
        clTitleBtn: $("#cl-title-btn"),
        retireBtn: $("#retire-btn"),
        // Ranking
        rankingBtn: $("#ranking-btn"),
        rankingBackBtn: $("#ranking-back-btn"),
        playerNameInput: $("#player-name-input"),
        playerNameSaveBtn: $("#player-name-save-btn"),
        playerNameMessage: $("#player-name-message"),
        tabBtns: document.querySelectorAll(".tab-btn"),
        rankingListContainer: $("#ranking-list-container"),
    };

    // ---- Utility ----
    function katakanaToHiragana(str) {
        return str.replace(/[\u30A1-\u30F6]/g, (ch) =>
            String.fromCharCode(ch.charCodeAt(0) - 0x60)
        );
    }

    function normalizeInput(str) {
        return katakanaToHiragana(str.trim());
    }

    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function getHighscore(level) {
        try {
            return parseInt(localStorage.getItem(`kanji_hs_${level}`) || "0", 10);
        } catch {
            return 0;
        }
    }

    function setHighscore(level, score) {
        try {
            localStorage.setItem(`kanji_hs_${level}`, String(score));
        } catch {
            // silently ignore
        }
    }

    // ---- Screen Management ----
    function showScreen(name) {
        Object.entries(screens).forEach(([key, el]) => {
            el.classList.toggle("active", key === name);
        });
        STATE.currentScreen = name;
    }

    // ---- Flash Effect ----
    function flashScreen(type) {
        const el = dom.screenFlash;
        el.className = "screen-flash";
        void el.offsetWidth; // force reflow
        el.classList.add(type === "correct" ? "correct-bg" : "incorrect-bg");
        setTimeout(() => {
            el.className = "screen-flash";
        }, 600);
    }

    // ---- Game Logic ----
    function startGame(level) {
        STATE.level = level;
        STATE.lives = 5;
        STATE.score = 0;
        STATE.streak = 0;
        STATE.bestStreak = 0;
        STATE.questionIndex = 0;
        STATE.isProcessing = false;

        const pool = QUESTIONS[level];
        if (!pool || pool.length === 0) {
            alert("問題データが見つかりません");
            return;
        }
        STATE.questionPool = shuffle(pool);
        STATE.totalQuestions = STATE.questionPool.length;

        // Update UI
        dom.levelBadge.textContent = `漢検${level}`;
        updateLives();
        updateScore();
        updateStreak();
        updateQuestionCount();
        dom.feedbackMessage.className = "feedback-message";
        dom.feedbackMessage.textContent = "";
        dom.answerInput.value = "";

        if (STATE.timerId) clearInterval(STATE.timerId);

        showScreen("game");
        nextQuestion();
        dom.answerInput.focus();
    }

    function nextQuestion() {
        if (STATE.questionIndex >= STATE.totalQuestions) {
            showClearScreen();
            return;
        }

        STATE.currentQuestion = STATE.questionPool[STATE.questionIndex];
        dom.kanjiText.textContent = STATE.currentQuestion.kanji;
        dom.kanjiText.className = "kanji-text";
        dom.answerInput.value = "";
        dom.answerInput.disabled = false;
        dom.submitBtn.disabled = false;
        dom.feedbackMessage.className = "feedback-message";
        dom.feedbackMessage.textContent = "";
        updateQuestionCount();
        dom.answerInput.focus();
        startTimer();
    }

    function startTimer() {
        if (STATE.timerId) clearInterval(STATE.timerId);
        STATE.timeLeft = STATE.timeLimit;
        updateTimerUI();

        STATE.timerId = setInterval(() => {
            STATE.timeLeft -= 0.1;
            if (STATE.timeLeft <= 0) {
                STATE.timeLeft = 0;
                handleTimeout();
            }
            updateTimerUI();
        }, 100);
    }

    function updateTimerUI() {
        const percentage = (STATE.timeLeft / STATE.timeLimit) * 100;
        dom.timerBar.style.width = `${percentage}%`;
        dom.timerText.textContent = STATE.timeLeft.toFixed(1);

        dom.timerBar.className = "timer-bar";
        dom.timerText.className = "timer-text";
        if (STATE.timeLeft <= 3.0) {
            dom.timerBar.classList.add("danger");
            dom.timerText.classList.add("danger");
        } else if (STATE.timeLeft <= 6.0) {
            dom.timerBar.classList.add("warning");
            dom.timerText.classList.add("warning");
        }
    }

    function handleTimeout() {
        if (STATE.isProcessing) return;
        if (STATE.timerId) clearInterval(STATE.timerId);

        STATE.isProcessing = true;
        dom.answerInput.disabled = true;
        dom.submitBtn.disabled = true;

        STATE.lives--;
        STATE.streak = 0;

        updateLives();
        updateStreak();
        flashScreen("incorrect");
        dom.kanjiText.classList.add("incorrect-flash");
        dom.livesDisplay.classList.add("shake");

        dom.feedbackMessage.className = "feedback-message incorrect show";
        dom.feedbackMessage.innerHTML = `⏰ 時間切れ！ 正解は「<strong>${STATE.currentQuestion.yomi}</strong>」`;

        setTimeout(() => {
            dom.livesDisplay.classList.remove("shake");
        }, 500);

        STATE.questionIndex++;

        if (STATE.lives <= 0) {
            setTimeout(() => {
                STATE.isProcessing = false;
                showGameOverScreen();
            }, 1500);
        } else {
            setTimeout(() => {
                STATE.isProcessing = false;
                nextQuestion();
            }, 1500);
        }
    }

    function submitAnswer() {
        if (STATE.isProcessing) return;
        const input = normalizeInput(dom.answerInput.value);

        STATE.isProcessing = true;
        if (STATE.timerId) clearInterval(STATE.timerId);

        dom.answerInput.disabled = true;
        dom.submitBtn.disabled = true;

        if (input === "") {
            handleIncorrect(); // 空白送信は不正解として扱う
            return;
        }

        const correct = input === STATE.currentQuestion.yomi;

        if (correct) {
            handleCorrect();
        } else {
            handleIncorrect();
        }
    }

    function handleCorrect() {
        STATE.score++;
        STATE.streak++;
        if (STATE.streak > STATE.bestStreak) STATE.bestStreak = STATE.streak;

        // Bonus: 5連続正解ごとにボーナス+1
        if (STATE.streak > 0 && STATE.streak % 5 === 0) {
            STATE.score++;
        }

        updateScore();
        updateStreak();
        flashScreen("correct");
        dom.kanjiText.classList.add("correct-flash");

        dom.feedbackMessage.className = "feedback-message correct show";
        dom.feedbackMessage.textContent = STATE.streak >= 3
            ? `⭐ 正解！ ${STATE.streak}連続正解！`
            : "⭕ 正解！";

        STATE.questionIndex++;
        setTimeout(() => {
            STATE.isProcessing = false;
            nextQuestion();
        }, 1000);
    }

    function handleIncorrect() {
        STATE.lives--;
        STATE.streak = 0;

        updateLives();
        updateStreak();
        flashScreen("incorrect");
        dom.kanjiText.classList.add("incorrect-flash");
        dom.livesDisplay.classList.add("shake");

        dom.feedbackMessage.className = "feedback-message incorrect show";
        dom.feedbackMessage.innerHTML = `❌ 不正解… 正解は「<strong>${STATE.currentQuestion.yomi}</strong>」`;

        setTimeout(() => {
            dom.livesDisplay.classList.remove("shake");
        }, 500);

        STATE.questionIndex++;

        if (STATE.lives <= 0) {
            setTimeout(() => {
                STATE.isProcessing = false;
                showGameOverScreen();
            }, 1500);
        } else {
            setTimeout(() => {
                STATE.isProcessing = false;
                nextQuestion();
            }, 1500);
        }
    }

    // ---- UI Updates ----
    function updateLives() {
        const filled = "❤️".repeat(STATE.lives);
        const empty = "🖤".repeat(5 - STATE.lives);
        dom.livesDisplay.textContent = filled + empty;
    }

    function updateScore() {
        dom.scoreDisplay.textContent = `SCORE: ${STATE.score}`;
    }

    function updateStreak() {
        if (STATE.streak >= 2) {
            dom.streakDisplay.textContent = `🔥 ${STATE.streak}連続正解`;
            dom.streakDisplay.classList.add("active");
            setTimeout(() => dom.streakDisplay.classList.remove("active"), 600);
        } else {
            dom.streakDisplay.textContent = "";
        }
    }

    function updateQuestionCount() {
        dom.questionCount.textContent = `${STATE.questionIndex + 1} / ${STATE.totalQuestions}`;
    }

    // ---- End Screens ----
    function showGameOverScreen() {
        if (STATE.timerId) clearInterval(STATE.timerId);
        const hs = getHighscore(STATE.level);
        const isNew = STATE.score > hs;
        if (isNew) setHighscore(STATE.level, STATE.score);
        const displayHs = isNew ? STATE.score : hs;

        // Firebaseへスコアを送信
        if (window.FirebaseDB && STATE.score > 0) {
            window.FirebaseDB.submitScore(STATE.level, STATE.score);
        }

        dom.goScore.textContent = STATE.score;
        dom.goHighscore.textContent = displayHs;
        dom.goStreak.textContent = STATE.bestStreak;
        dom.goNewHighscore.classList.toggle("hidden", !isNew);

        showScreen("gameover");
    }

    function showClearScreen() {
        if (STATE.timerId) clearInterval(STATE.timerId);
        const hs = getHighscore(STATE.level);
        const isNew = STATE.score > hs;
        if (isNew) setHighscore(STATE.level, STATE.score);
        const displayHs = isNew ? STATE.score : hs;

        // Firebaseへスコアを送信
        if (window.FirebaseDB && STATE.score > 0) {
            window.FirebaseDB.submitScore(STATE.level, STATE.score);
        }

        dom.clScore.textContent = STATE.score;
        dom.clHighscore.textContent = displayHs;
        dom.clStreak.textContent = STATE.bestStreak;
        dom.clNewHighscore.classList.toggle("hidden", !isNew);

        showScreen("clear");
    }

    // ---- Event Listeners ----
    dom.startBtn.addEventListener("click", () => {
        if (dom.testInput) dom.testInput.value = "";
        showScreen("level");
    });

    // Settings
    if (dom.settingsBtn) {
        dom.settingsBtn.addEventListener("click", () => showScreen("settings"));
    }
    if (dom.settingsBackBtn) {
        dom.settingsBackBtn.addEventListener("click", () => showScreen("level"));
    }

    if (dom.timeBtns) {
        dom.timeBtns.forEach((btn) => {
            btn.addEventListener("click", () => {
                const time = parseFloat(btn.getAttribute("data-time"));
                STATE.timeLimit = time;

                // Update active state visual
                dom.timeBtns.forEach(b => b.classList.remove("active-setting"));
                btn.classList.add("active-setting");

                // Go back to level screen
                showScreen("level");
            });
        });
    }

    // Anti-cheat: Prevent copy and right-click on kanji text
    if (dom.kanjiText) {
        dom.kanjiText.addEventListener("contextmenu", (e) => e.preventDefault());
        dom.kanjiText.addEventListener("copy", (e) => e.preventDefault());
    }

    if (dom.testInput) {
        dom.testInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                dom.testInput.value = "";
                showScreen("level");
            }
        });
    }

    dom.levelBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            const level = btn.getAttribute("data-level");
            startGame(level);
        });
    });

    dom.submitBtn.addEventListener("click", submitAnswer);

    dom.answerInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            submitAnswer();
        }
    });

    // Retire button
    dom.retireBtn.addEventListener("click", () => {
        if (STATE.isProcessing) return;
        if (STATE.timerId) clearInterval(STATE.timerId);
        showGameOverScreen();
    });

    // Retry & Title buttons
    dom.retryBtn.addEventListener("click", () => startGame(STATE.level));
    dom.goTitleBtn.addEventListener("click", () => showScreen("level"));
    dom.clRetryBtn.addEventListener("click", () => startGame(STATE.level));
    dom.clTitleBtn.addEventListener("click", () => showScreen("title"));

    // ---- Ranking & Player Name ----
    if (dom.rankingBtn) {
        dom.rankingBtn.addEventListener("click", () => {
            showScreen("ranking");
            // アクティブなタブを1級にリセット
            dom.tabBtns.forEach(b => b.classList.remove("active"));
            if (dom.tabBtns[0]) dom.tabBtns[0].classList.add("active");
            loadRanking("1級");
        });
    }

    if (dom.rankingBackBtn) {
        dom.rankingBackBtn.addEventListener("click", () => showScreen("level"));
    }

    if (dom.playerNameSaveBtn) {
        dom.playerNameSaveBtn.addEventListener("click", async () => {
            const newName = dom.playerNameInput.value.trim();
            dom.playerNameMessage.className = "name-message";
            dom.playerNameMessage.textContent = "確認中...";
            
            if (!window.FirebaseDB) {
                dom.playerNameMessage.textContent = "システム準備中...";
                return;
            }

            try {
                // 通信が環境により遅れる場合があるため、タイムアウトを長めに設定（30秒）
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error("TIMEOUT")), 30000);
                });
                
                const result = await Promise.race([
                    window.FirebaseDB.updatePlayerName(newName),
                    timeoutPromise
                ]);

                if (result.success) {
                    dom.playerNameMessage.className = "name-message success";
                    dom.playerNameMessage.textContent = "名前を登録しました！";
                } else {
                    dom.playerNameMessage.className = "name-message error";
                    dom.playerNameMessage.textContent = result.message;
                }
            } catch (e) {
                console.error(e);
                dom.playerNameMessage.className = "name-message error";
                if (e.message === "TIMEOUT") {
                    dom.playerNameMessage.textContent = "通信がブロックされています(VS Code等のLive Serverで開いてください)";
                } else {
                    dom.playerNameMessage.textContent = "予期せぬエラーが発生しました";
                }
            }
            
            setTimeout(() => {
                dom.playerNameMessage.textContent = "";
            }, 5000);
        });
    }

    if (dom.tabBtns) {
        dom.tabBtns.forEach(btn => {
            btn.addEventListener("click", (e) => {
                dom.tabBtns.forEach(b => b.classList.remove("active"));
                e.target.classList.add("active");
                const level = e.target.getAttribute("data-level");
                loadRanking(level);
            });
        });
    }

    async function loadRanking(level) {
        if (!window.FirebaseDB) {
            dom.rankingListContainer.innerHTML = '<div class="loading-spinner">システム準備中...</div>';
            return;
        }
        dom.rankingListContainer.innerHTML = '<div class="loading-spinner">読み込み中...</div>';
        const ranking = await window.FirebaseDB.getRanking(level);
        
        if (ranking.length === 0) {
            dom.rankingListContainer.innerHTML = '<div class="loading-spinner">まだ記録がありません</div>';
            return;
        }

        let html = "";
        ranking.forEach((r, idx) => {
            const rankClass = idx < 3 ? `rank-${idx + 1}` : "";
            const meClass = r.isMe ? "is-me" : "";
            html += `
                <div class="ranking-item ${rankClass} ${meClass}">
                    <div class="rank-number">${idx + 1}</div>
                    <div class="rank-name">${escapeHTML(r.name)}</div>
                    <div class="rank-score">${r.score}</div>
                </div>
            `;
        });
        dom.rankingListContainer.innerHTML = html;
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag));
    }

    // ---- Init ----
    // FirebaseDBモジュールが読み込まれるのを少し待ってから名前をセット
    setTimeout(() => {
        if (window.FirebaseDB && dom.playerNameInput) {
            dom.playerNameInput.value = window.FirebaseDB.getPlayerName();
        }
    }, 1000);

    showScreen("title");
})();
