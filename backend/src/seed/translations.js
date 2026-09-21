'use strict';

/**
 * Chinese and Japanese copy for the seeded catalogue.
 *
 * Keyed by the canonical English name/title in data.js, so the two files can be
 * edited independently: add a product there, add its translations here, and the
 * seeder wires them together. A missing entry is not an error — the product
 * simply falls back to its English fields, exactly as it would in production.
 *
 * English is intentionally absent: the canonical top-level fields already are
 * the English copy, and duplicating them here would give us two sources of
 * truth to keep in sync.
 */

const categories = {
  Electronics: {
    zh: { name: '电子产品', description: '手机、笔记本电脑、音频设备等' },
    ja: { name: '家電・電子機器', description: 'スマートフォン、ノートPC、オーディオなど' },
  },
  Fashion: {
    zh: { name: '时尚服饰', description: '服装、鞋履与配饰' },
    ja: { name: 'ファッション', description: '衣料品、シューズ、アクセサリー' },
  },
  'Home & Living': {
    zh: { name: '家居生活', description: '家具、家饰与厨房用品' },
    ja: { name: 'ホーム＆リビング', description: '家具、インテリア、キッチン用品' },
  },
  'Beauty & Health': {
    zh: { name: '美妆健康', description: '护肤、保健与个人护理' },
    ja: { name: 'ビューティー＆ヘルス', description: 'スキンケア、ウェルネス、パーソナルケア' },
  },
  'Sports & Outdoors': {
    zh: { name: '运动户外', description: '健身装备与户外用品' },
    ja: { name: 'スポーツ＆アウトドア', description: 'フィットネス用品、アウトドアギア' },
  },
  'Toys & Games': {
    zh: { name: '玩具游戏', description: '玩具、桌游与游戏主机' },
    ja: { name: 'おもちゃ・ゲーム', description: 'おもちゃ、ボードゲーム、ゲーム機' },
  },
  Groceries: {
    zh: { name: '生鲜食品', description: '新鲜健康的有机食品' },
    ja: { name: '食料品', description: '新鮮で健康的なオーガニック食品' },
  },
  Books: {
    zh: { name: '图书', description: '小说、非虚构与教材' },
    ja: { name: '書籍', description: '小説、ノンフィクション、専門書' },
  },
  Automotive: {
    zh: { name: '汽车用品', description: '汽车养护、配件与用品' },
    ja: { name: 'カー用品', description: 'カーケア、パーツ、アクセサリー' },
  },

  Headphones: { zh: { name: '耳机' }, ja: { name: 'ヘッドホン' } },
  Laptops: { zh: { name: '笔记本电脑' }, ja: { name: 'ノートPC' } },
  Smartphones: { zh: { name: '智能手机' }, ja: { name: 'スマートフォン' } },
  Cameras: { zh: { name: '相机' }, ja: { name: 'カメラ' } },
  Wearables: { zh: { name: '智能穿戴' }, ja: { name: 'ウェアラブル' } },
  Footwear: { zh: { name: '鞋履' }, ja: { name: 'シューズ' } },
  Bags: { zh: { name: '箱包' }, ja: { name: 'バッグ' } },
};

const products = {
  'Wireless Headphones Pro': {
    zh: {
      name: '无线降噪耳机 Pro',
      shortDescription: '顶级音质与主动降噪，音乐、游戏、通话皆宜。',
      description:
        '无线降噪耳机 Pro 采用自适应主动降噪技术，带来录音室级音质。40 小时续航、'
        + '蓝牙 5.3 多点连接与记忆棉耳垫，让它无论在长途飞行还是整日办公都同样合适。'
        + '快充 10 分钟即可获得 5 小时播放时间。',
    },
    ja: {
      name: 'ワイヤレスヘッドホン Pro',
      shortDescription: '高音質とアクティブノイズキャンセリング。音楽もゲームも通話も快適に。',
      description:
        'ワイヤレスヘッドホン Pro は、適応型アクティブノイズキャンセリングによりスタジオ品質の'
        + 'サウンドをお届けします。40 時間のバッテリー、Bluetooth 5.3 のマルチポイント接続、'
        + '低反発イヤークッションを備え、長時間のフライトにも一日の仕事にも最適です。'
        + '10 分の急速充電で 5 時間再生できます。',
    },
  },
  'Smart Watch Series 7': {
    zh: {
      name: '智能手表 Series 7',
      shortDescription: '健康监测、GPS 与 7 天续航，配常亮 AMOLED 屏幕。',
      description:
        '可监测心率、血氧、睡眠阶段以及 100 多种运动模式。1.9 英寸常亮 AMOLED 屏幕在'
        + '强光下依然清晰可读，5ATM 防水等级让您可以佩戴游泳。',
    },
    ja: {
      name: 'スマートウォッチ Series 7',
      shortDescription: '健康管理、GPS、7 日間バッテリー。常時表示の AMOLED ディスプレイ搭載。',
      description:
        '心拍数、血中酸素、睡眠ステージに加え、100 種類以上のワークアウトモードを記録します。'
        + '1.9 インチの常時表示 AMOLED パネルは直射日光下でも見やすく、5ATM の防水性能で'
        + '着けたまま泳ぐこともできます。',
    },
  },
  'Laptop Pro 15"': {
    zh: {
      name: '专业笔记本电脑 15 英寸',
      shortDescription: '15 英寸视网膜屏、16GB 内存与 1TB 固态硬盘，机身仅 1.6 公斤。',
      description:
        '专为开发者与创作者打造的 15 英寸工作站。16GB 统一内存、1TB NVMe 固态硬盘与'
        + '8 核处理器，可从容应对编译、渲染与上百个浏览器标签页，风扇依然安静。'
        + '实际续航可达 18 小时。',
    },
    ja: {
      name: 'ノートPC Pro 15インチ',
      shortDescription: '15インチ Retina ディスプレイ、16GB RAM、1TB SSD を 1.6kg のアルミボディに。',
      description:
        '開発者とクリエイターのための 15 インチワークステーション。16GB のユニファイドメモリ、'
        + '1TB NVMe SSD、8 コア CPU が、ビルドもレンダリングも 100 個のブラウザタブも'
        + 'ファンを回さずに処理します。実使用で最大 18 時間のバッテリー駆動。',
    },
  },
  'Smartphone Galaxy X': {
    zh: {
      name: '智能手机 Galaxy X',
      shortDescription: '6.7 英寸 120Hz AMOLED 屏、5000 万像素三摄与 5000mAh 全天候电池。',
      description:
        '旗舰 5G 手机，配备 6.7 英寸 120Hz AMOLED 显示屏、支持光学防抖的 5000 万像素'
        + '三摄系统，以及 45W 快充——20 分钟即可充至半电。',
    },
    ja: {
      name: 'スマートフォン Galaxy X',
      shortDescription: '6.7インチ 120Hz AMOLED、5000万画素トリプルカメラ、5000mAh バッテリー。',
      description:
        '6.7 インチ 120Hz AMOLED ディスプレイ、光学式手ぶれ補正付きの 5000 万画素'
        + 'トリプルカメラ、20 分で半分まで充電できる 45W 急速充電を備えたフラッグシップ 5G スマートフォンです。',
    },
  },
  'Camera DSLR 4K': {
    zh: {
      name: '4K 单反相机',
      shortDescription: '2400 万像素 APS-C 传感器、4K60 视频与全像素双核对焦，含套机镜头。',
      description:
        '2420 万像素 APS-C 传感器搭配全像素双核相位检测对焦、4K60 内录与全翻转触摸屏。'
        + '随机附赠 18-55mm 防抖套机镜头。',
    },
    ja: {
      name: '一眼レフカメラ 4K',
      shortDescription: '2400万画素 APS-C センサー、4K60 動画、デュアルピクセル AF。レンズキット付属。',
      description:
        '2420 万画素 APS-C センサーにデュアルピクセル位相差 AF、4K60 内部記録、'
        + 'バリアングルタッチスクリーンを搭載。手ぶれ補正付き 18-55mm キットレンズが付属します。',
    },
  },
  'Gaming Console Ultra': {
    zh: {
      name: '游戏主机 Ultra',
      shortDescription: '4K 120 帧游戏体验、1TB 固态硬盘，标配触感手柄。',
      description:
        '新一代游戏主机，搭载定制 8 核处理器，支持最高 120 帧的 4K 光线追踪画面，'
        + '1TB NVMe 固态硬盘可在数秒内加载开放世界。随机附赠一只触感反馈手柄。',
    },
    ja: {
      name: 'ゲーム機 Ultra',
      shortDescription: '4K 120fps ゲーミング、1TB SSD、触覚コントローラー同梱。',
      description:
        'カスタム 8 コア CPU を搭載し、最大 120fps のレイトレーシング 4K グラフィックスを'
        + '実現する次世代ゲーム機。1TB NVMe SSD がオープンワールドを数秒で読み込みます。'
        + '触覚フィードバック対応コントローラーが 1 台付属します。',
    },
  },
  'Running Shoes Flex': {
    zh: {
      name: '轻量跑鞋 Flex',
      shortDescription: '轻质泡棉中底搭配透气针织鞋面，适合日常跑步。',
      description:
        '重量仅 238 克的高回弹日常训练跑鞋。压模泡棉中底在每一步提供能量回馈，'
        + '工程针织鞋面则让双脚在长距离奔跑中保持凉爽。',
    },
    ja: {
      name: 'ランニングシューズ Flex',
      shortDescription: '軽量フォームミッドソールと通気性の高いニットアッパーで毎日のランに。',
      description:
        'わずか 238g の反発性に優れたデイリートレーナー。圧縮成形フォームミッドソールが'
        + '一歩ごとにエネルギーを返し、エンジニアードニットアッパーが長距離でも足を涼しく保ちます。',
    },
  },
  'Everyday Backpack 24L': {
    zh: {
      name: '日常通勤背包 24L',
      shortDescription: '24 升防泼水背包，内置 16 英寸笔记本电脑隔层。',
      description:
        '采用防泼水再生聚酯纤维的 24 升通勤背包，配有绒布内衬的 16 英寸笔记本隔层、'
        + '用于存放贵重物品的隐藏背袋，以及可套挂行李箱拉杆的背带。',
    },
    ja: {
      name: 'デイリーバックパック 24L',
      shortDescription: '撥水加工の 24L バックパック。16インチ対応のパッド入り PC スリーブ付き。',
      description:
        '撥水リサイクルポリエステル製の 24 リットル通勤用バックパック。フリース裏地の'
        + '16 インチ PC スリーブ、貴重品用の背面隠しポケット、キャリーバッグに通せる'
        + 'ラゲッジストラップを備えています。',
    },
  },
  'Classic Cotton T-Shirt': {
    zh: {
      name: '经典纯棉 T 恤',
      shortDescription: '180 克有机棉 T 恤，宽松版型且不易变形。',
      description:
        '采用 180 克认证有机棉裁制，预缩处理的宽松版型与双针车缝下摆经得起反复水洗。'
        + '提供四款四季百搭配色。',
    },
    ja: {
      name: 'クラシックコットン T シャツ',
      shortDescription: '180gsm のオーガニックコットン。型崩れしにくいリラックスフィット。',
      description:
        '認証オーガニックコットン 180gsm を使用し、防縮加工を施したリラックスフィット。'
        + '二本針の裾縫製で洗濯にも強い仕上がりです。通年使える 4 色展開。',
    },
  },
  'Organic Fruit Box': {
    zh: {
      name: '有机水果礼盒',
      shortDescription: '每周一盒当季有机水果，采摘后 24 小时内送达。',
      description:
        '来自合作农场的 7 至 9 种认证有机时令水果，接单后采摘，并在采摘后 24 小时内送达。'
        + '盒内品种随季节轮换。',
    },
    ja: {
      name: 'オーガニックフルーツボックス',
      shortDescription: '旬のオーガニックフルーツを毎週お届け。収穫から 24 時間以内に発送。',
      description:
        '提携農家から受注後に収穫した、認証オーガニックの旬の果物 7〜9 種類を'
        + '収穫から 24 時間以内にお届けします。内容は季節ごとに変わります。',
    },
  },
  'Espresso Machine Barista': {
    zh: {
      name: '半自动咖啡机 Barista',
      shortDescription: '15 帕泵压、内置磨豆器与蒸汽棒，轻松打出细腻奶泡。',
      description:
        '15 帕泵压意式咖啡机，配备锥形磨盘磨豆器、PID 温控与商用级蒸汽棒。'
        + '冷机启动后 28 秒即可萃取一杯风味均衡的双份浓缩。',
    },
    ja: {
      name: 'エスプレッソマシン Barista',
      shortDescription: '15 気圧ポンプ、豆挽き機内蔵、きめ細かいミルクフォームが作れるスチームワンド。',
      description:
        'コニカルバーグラインダー、PID 温度制御、業務用仕様のスチームワンドを備えた'
        + '15 気圧ポンプ式エスプレッソマシン。コールドスタートから 28 秒で'
        + 'バランスの取れたダブルショットを抽出します。',
    },
  },
  'Vitamin C Serum': {
    zh: {
      name: '维生素 C 精华液',
      shortDescription: '15% 稳定型维生素 C 搭配透明质酸，令肌肤更亮泽均匀。',
      description:
        '质地轻盈的 15% 左旋维生素 C 精华，添加阿魏酸与透明质酸。数秒即可吸收，'
        + '可叠涂于防晒之下，每日使用四周后肤色明显更加均匀。',
    },
    ja: {
      name: 'ビタミン C 美容液',
      shortDescription: '15% の安定型ビタミン C とヒアルロン酸で、明るく均一な肌へ。',
      description:
        'フェルラ酸とヒアルロン酸を配合した軽いテクスチャーの 15% L-アスコルビン酸美容液。'
        + '数秒で浸透し、日焼け止めの下にも重ねられます。毎日 4 週間の使用で'
        + '肌のトーンが目に見えて整います。',
    },
  },
  'Yoga Mat Pro': {
    zh: {
      name: '专业瑜伽垫 Pro',
      shortDescription: '6 毫米防滑 TPE 瑜伽垫，带体位对齐线与便携背带。',
      description:
        '6 毫米闭孔 TPE 瑜伽垫，既能缓冲关节压力又不会过度塌陷。激光雕刻的对齐线'
        + '有助于保持正确体态，磨砂表面即使在高温瑜伽中也能保持抓地力。',
    },
    ja: {
      name: 'ヨガマット Pro',
      shortDescription: '6mm の滑りにくい TPE マット。アライメントライン付き、キャリーストラップ同梱。',
      description:
        '関節を守りつつ沈み込みすぎない 6mm の独立気泡 TPE マット。レーザー刻印の'
        + 'アライメントラインが姿勢づくりを助け、テクスチャー加工の表面は'
        + 'ホットヨガでもグリップを保ちます。',
    },
  },
  'Mechanical Keyboard TKL': {
    zh: {
      name: '机械键盘 TKL',
      shortDescription: '支持热插拔的 87 键机械键盘，PBT 键帽与南向 RGB 灯效。',
      description:
        '支持热插拔轴座的 87 键机械键盘，采用 Gasket 结构定位板、二色成型 PBT 键帽'
        + '与逐键南向 RGB 背光。支持 USB-C、蓝牙与 2.4GHz 三模连接。',
    },
    ja: {
      name: 'メカニカルキーボード TKL',
      shortDescription: 'ホットスワップ対応のテンキーレス。PBT キーキャップと南向き RGB を搭載。',
      description:
        'ホットスワップソケット、ガスケットマウントプレート、二色成形 PBT キーキャップ、'
        + 'キーごとの南向き RGB を備えたテンキーレスメカニカルキーボード。'
        + 'USB-C、Bluetooth、2.4GHz の 3 モード接続に対応します。',
    },
  },
  'Bestseller Novel Collection': {
    zh: {
      name: '畅销小说典藏套装',
      shortDescription: '六部获奖当代小说，精装函套典藏版。',
      description:
        '六部广受好评的当代小说，以亚麻精装函套收藏，每册均附作者全新撰写的导读。'
        + '送给爱书之人的现成礼物。',
    },
    ja: {
      name: 'ベストセラー小説コレクション',
      shortDescription: '受賞歴のある現代小説 6 冊を、ハードカバーの函入りセットで。',
      description:
        '高い評価を受けた現代小説 6 冊を、リネン装丁のハードカバー函入りセットに収録。'
        + '各巻に著者による新しい序文を収めています。本好きへの贈り物に最適です。',
    },
  },
  'Car Dash Cam 4K': {
    zh: {
      name: '4K 行车记录仪',
      shortDescription: '前录 4K、后录 1080p，内置 GPS 轨迹记录。',
      description:
        '前镜头录制 4K、后镜头录制 1080p，配备 140 度广角镜头、GPS 车速与位置记录，'
        + '以及受到碰撞即唤醒的停车监控模式。',
    },
    ja: {
      name: 'ドライブレコーダー 4K',
      shortDescription: 'フロント 4K、リア 1080p 録画。GPS ログ機能内蔵。',
      description:
        'フロントは 4K、リアは 1080p で録画。140 度の広角レンズ、GPS による速度・位置の'
        + '記録、衝撃を検知して起動する駐車監視モードを搭載しています。',
    },
  },
};

const banners = {
  'Discover Premium Products': {
    zh: {
      title: '发现优质好物',
      subtitle: '一线品牌 · 更优价格 · 更快送达',
      ctaText: '立即选购',
    },
    ja: {
      title: 'プレミアムな商品を見つけよう',
      subtitle: '人気ブランドを、より良い価格で、より早くお届け。',
      ctaText: '今すぐ購入',
    },
  },
  'Big Sale Up to 50% OFF': {
    zh: {
      title: '年中大促 低至 5 折',
      subtitle: '精选电子产品限时优惠',
      ctaText: '抢购优惠',
    },
    ja: {
      title: '最大 50% OFF の大セール',
      subtitle: '対象の家電が期間限定のお買い得価格に',
      ctaText: 'セールを見る',
    },
  },
  'Fresh & Healthy Organic Food': {
    zh: {
      title: '新鲜健康有机食品',
      subtitle: '本周生鲜低至 7 折',
      ctaText: '选购生鲜',
    },
    ja: {
      title: '新鮮でヘルシーなオーガニック食品',
      subtitle: '今週は食料品が最大 30% OFF',
      ctaText: '食料品を見る',
    },
  },
};

/**
 * Looks up one entry and returns it in the `{ zh: {...}, ja: {...} }` shape the
 * models expect. Unknown keys return an empty object so the seeder can call
 * this unconditionally.
 */
function translationsFor(table, key) {
  return (table && table[key]) || {};
}

module.exports = {
  categories,
  products,
  banners,
  translationsFor,
};
