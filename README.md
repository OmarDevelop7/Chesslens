# ChessLens (Desktop)
تطبيق كمبيوتر لتحليل الشطرنج بمحرك Stockfish 19 الأصلي (أوفلاين، كل الأنوية).

## بناء الـ .exe (من غير ما تنصّب حاجة على جهازك)
1. اعمل repo جديد على GitHub وارفع محتوى الفولدر ده كله (بما فيه `.github`).
2. من تبويب **Actions** شغّل **Build desktop app** (Run workflow).
3. بعد ما يخلص نزّل الـ installer من **Artifacts** (ويندوز / لينكس / ماك).

## تشغيل للتجربة على جهازك
```
npm install
# حط ملف stockfish في فولدر engine/ (stockfish.exe على ويندوز)
npm start
```
بدون Electron: `node server.js path/to/stockfish` ثم افتح http://127.0.0.1:8765

## تراخيص
Stockfish (GPLv3) ← لازم تنشر الكود مع التطبيق (الـ repo نفسه يكفي). قطع Staunty (CC BY-NC-SA 4.0، غير تجاري). قاعدة الافتتاحيات من Lichess (CC0). chess.js (BSD).
