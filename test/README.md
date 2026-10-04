# Pocket Web MVP

最終的なHTTPS Web公開を前提にした、URL表示＋ポケットモードのMVPです。

## 機能
- URL入力
- 一般Webページをiframe表示
- YouTube URLをYouTube IFrame Playerで表示
- ポケットモード
- タッチ操作ブロック
- 3秒長押しで解除
- Wake Lock対応ブラウザで画面スリープ抑制
- PWA用manifest / Service Worker
- 最後のURLを保存

## ローカルテスト
このフォルダで以下を実行:
python -m http.server 8000

PC:
http://localhost:8000/

iPhone:
http://PCのIPアドレス:8000/

iPhoneからLANのHTTPへアクセスする場合、Secure ContextではないためWake LockやService Worker/PWAの検証には向きません。本番はHTTPSで公開してください。

## 制限
一般WebサイトがX-Frame-OptionsやCSPでiframeを拒否している場合、そのサイトは表示できません。

YouTube検索、履歴、お気に入り、ログイン、バックエンドはMVPには含めていません。
