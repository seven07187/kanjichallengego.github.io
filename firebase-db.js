import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getFirestore, initializeFirestore, collection, doc, setDoc, getDocs, getDoc, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBe5pKfYdGq1eVhpcAAdEa6sa7aW50BRC0",
  authDomain: "kanjichallengego.firebaseapp.com",
  projectId: "kanjichallengego",
  storageBucket: "kanjichallengego.firebasestorage.app",
  messagingSenderId: "78967484383",
  appId: "1:78967484383:web:005797bd3bdd09ace2de6a",
  measurementId: "G-S6E1F4XS0G"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
// 通信環境によってはWebSocketが繋がらず固まる場合があるため、LongPollingを強制するオプションを追加
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});

// ユーザーIDの取得と生成
function getUserId() {
    let uid = localStorage.getItem("kanji_user_id");
    if (!uid) {
        uid = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        localStorage.setItem("kanji_user_id", uid);
    }
    return uid;
}

// 名前の登録と一意性チェック
async function updatePlayerName(newName) {
    if (!newName) return { success: false, message: "名前を入力してください" };
    
    const uid = getUserId();
    const usersRef = collection(db, "users");
    
    try {
        console.log("1. 名前の重複チェックを開始:", newName);
        const q = query(usersRef, where("name", "==", newName));
        const querySnapshot = await getDocs(q);
        
        console.log("2. 重複チェック完了。データ確認中...");
        let isDuplicate = false;
        querySnapshot.forEach((d) => {
            if (d.id !== uid) {
                isDuplicate = true;
            }
        });

        if (isDuplicate) {
            console.log("重複エラー: すでに使用されている名前です");
            return { success: false, message: "その名前は既に使用されています" };
        }

        console.log("3. データベースに名前を保存中...");
        await setDoc(doc(db, "users", uid), { name: newName });
        console.log("4. 保存完了。ローカルに記録します。");
        localStorage.setItem("kanji_user_name", newName);
        return { success: true };
    } catch (e) {
        console.error("名前の保存・確認に失敗しました:", e);
        // エラーメッセージにPermissionエラーかどうかのヒントを入れる
        if (e.message && e.message.includes("Missing or insufficient permissions")) {
            return { success: false, message: "データベースのアクセス権限がありません(ルール設定をご確認ください)" };
        }
        return { success: false, message: "通信エラーが発生しました。時間を置いてお試しください" };
    }
}

// ローカルの名前を取得
function getPlayerName() {
    return localStorage.getItem("kanji_user_name") || "";
}

// スコア送信処理
async function submitScore(level, score) {
    const uid = getUserId();
    const name = getPlayerName();
    
    if (!name) {
        // 名前未設定の場合は送信しない
        return false;
    }

    const docId = `${level}_${uid}`;
    try {
        const scoreRef = doc(db, "highscores", docId);
        const docSnap = await getDoc(scoreRef);
        
        if (docSnap.exists()) {
            const currentHigh = docSnap.data().score;
            if (score <= currentHigh) {
                return false; // 更新なし
            }
        }

        await setDoc(scoreRef, {
            userId: uid,
            level: level,
            score: score,
            timestamp: Date.now()
        });
        return true;
    } catch (e) {
        console.error("スコアの送信に失敗:", e);
        return false;
    }
}

// ランキング取得
async function getRanking(level) {
    try {
        const q = query(collection(db, "highscores"), where("level", "==", level), orderBy("score", "desc"), limit(10));
        const querySnapshot = await getDocs(q);
        
        let ranking = [];
        for (const d of querySnapshot.docs) {
            const data = d.data();
            // userIdから最新の名前を取得
            const userSnap = await getDoc(doc(db, "users", data.userId));
            const playerName = userSnap.exists() ? userSnap.data().name : "名無し";
            
            ranking.push({
                name: playerName,
                score: data.score,
                isMe: data.userId === getUserId()
            });
        }
        return ranking;
    } catch (e) {
        console.error("ランキング取得エラー:", e);
        return [];
    }
}

// グローバルに露出
window.FirebaseDB = {
    getUserId,
    getPlayerName,
    updatePlayerName,
    submitScore,
    getRanking
};
