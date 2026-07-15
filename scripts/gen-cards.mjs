// 卡池擴充生成器（司令：往 1000 張）。批次生成「安全題材」卡——動物／植物／自然／器物，
// 觀察得到的自然世界，非神聖／傳說題材（legend 主題與 Gaya/Utux/Sisin 一律不自動生成，走文化複核）。
// 規則：重用引擎現有效果與關鍵字、依費用平衡數值、決定性（同輸入同輸出，可重現 build）、
// 去重（跳過已存在的卡名）、每張配一個真實 vocabId（/collection 會 vocab() 查，需有效）。
// 產出 src/data/cards.generated.json，由 cards.ts 併進 CARDS。
//
// 往 1000 張：把更多「已審核」的安全題材主題名字加進下面的 SUBJECTS 再跑一次即可。
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const existing = new Set(
  [...readFileSync("src/data/cards.ts", "utf8").matchAll(/nameZh: "([^"]+)"/g)].map((m) => m[1]),
);
const vocabIds = JSON.parse(readFileSync("src/data/truku-vocab.json", "utf8")).entries.map((e) => e.id);

// ── 安全題材主題名（真實台灣山林自然物，避開神聖/禁忌/占卜鳥類）。type: m=隨從 s=法術 ──
// 分批：每個內層陣列＝一批。批次 1 的順序固定不動（id 依攤平後位置編，才不會擾動已生的圖）。
const B1_SUBJECTS = [
  // 動物（哺乳）
  ["石虎", "animal", "m"], ["白鼻心", "animal", "m"], ["鼬獾", "animal", "m"], ["黃喉貂", "animal", "m"],
  ["台灣野兔", "animal", "m"], ["赤腹松鼠", "animal", "m"], ["長鬃山羊", "animal", "m"], ["水獺", "animal", "m"],
  // 動物（鳥，非占卜靈鳥）
  ["五色鳥", "animal", "m"], ["綠繡眼", "animal", "m"], ["翠鳥", "animal", "m"], ["夜鷺", "animal", "m"],
  ["白鷺鷥", "animal", "m"], ["大冠鷲", "animal", "m"], ["帝雉", "animal", "m"], ["藍腹鷴", "animal", "m"],
  ["環頸雉", "animal", "m"], ["竹雞", "animal", "m"], ["台灣藍鵲", "animal", "m"], ["小雨燕", "animal", "m"],
  // 動物（魚蟲兩棲）
  ["香魚", "animal", "m"], ["苦花", "animal", "m"], ["何氏棘魞", "animal", "m"], ["溪哥仔", "animal", "m"],
  ["獨角仙", "animal", "m"], ["鍬形蟲", "animal", "m"], ["螢火蟲", "animal", "m"], ["蜻蜓", "animal", "m"],
  ["竹節蟲", "animal", "m"], ["紋白蝶", "animal", "m"], ["莫氏樹蛙", "animal", "m"], ["盤古蟾蜍", "animal", "m"],
  // 植物（樹）
  ["台灣杉", "plant", "m"], ["台灣扁柏", "plant", "m"], ["台灣二葉松", "plant", "m"], ["玉山圓柏", "plant", "m"],
  ["昆欄樹", "plant", "m"], ["牛樟", "plant", "m"], ["烏心石", "plant", "m"], ["楓香", "plant", "m"],
  ["青楓", "plant", "m"], ["台灣櫸", "plant", "m"], ["構樹", "plant", "m"], ["山黃麻", "plant", "m"],
  // 植物（花草蕨）
  ["森氏杜鵑", "plant", "m"], ["玉山薄雪草", "plant", "m"], ["阿里山龍膽", "plant", "m"], ["台灣一葉蘭", "plant", "m"],
  ["筆筒樹", "plant", "m"], ["月桃", "plant", "m"], ["五節芒", "plant", "m"], ["血桐", "plant", "m"],
  ["山棕", "plant", "m"], ["黃藤", "plant", "m"], ["台灣馬醉木", "plant", "m"], ["昭和草", "plant", "m"],
  // 器物（工具/食物）
  ["竹筒飯", "tool", "m"], ["醃肉", "tool", "m"], ["藤編籃", "tool", "m"], ["苧麻線", "tool", "m"],
  ["木臼", "tool", "m"], ["竹杯", "tool", "m"], ["骨針", "tool", "m"], ["石斧", "tool", "m"],
  ["魚簍", "tool", "m"], ["蜂蠟", "tool", "m"], ["火種", "tool", "m"], ["獸皮", "tool", "m"],
  // 自然/天氣/地景（多做法術）
  ["晨霧", "nature", "s"], ["山風", "nature", "s"], ["雷雨", "nature", "s"], ["冰雹", "nature", "s"],
  ["寒流", "nature", "s"], ["土石流", "nature", "s"], ["山崩", "nature", "s"], ["湍流", "nature", "s"],
  ["深潭", "nature", "s"], ["斷崖", "nature", "s"], ["雲海", "nature", "s"], ["霜降", "nature", "s"],
  ["溪水暴漲後", "nature", "s"], ["山谷回音", "nature", "s"], ["夜霧", "nature", "s"], ["朝陽初露", "nature", "s"],
  // ── 批次1 擴充（往 ~180；仍為安全題材、真實台灣山林物、避紅線）──
  // 動物（哺乳/鳥/兩棲爬蟲/魚蟲）
  ["梅花鹿", "animal", "m"], ["麝香貓", "animal", "m"], ["食蟹獴", "animal", "m"], ["白面鼯鼠", "animal", "m"], ["條紋松鼠", "animal", "m"],
  ["白頭翁", "animal", "m"], ["樹鵲", "animal", "m"], ["朱鸝", "animal", "m"], ["青背山雀", "animal", "m"], ["紫嘯鶇", "animal", "m"],
  ["鉛色水鶇", "animal", "m"], ["河烏", "animal", "m"], ["小啄木", "animal", "m"], ["灰喉山椒鳥", "animal", "m"], ["黑枕藍鶲", "animal", "m"],
  ["栗背林鴝", "animal", "m"], ["火冠戴菊", "animal", "m"], ["黃山雀", "animal", "m"], ["攀木蜥蜴", "animal", "m"], ["麗紋石龍子", "animal", "m"],
  ["台灣草蜥", "animal", "m"], ["台北樹蛙", "animal", "m"], ["梭德氏赤蛙", "animal", "m"], ["斯文豪氏赤蛙", "animal", "m"], ["中國樹蟾", "animal", "m"],
  ["台灣石賓", "animal", "m"], ["爬岩鰍", "animal", "m"], ["明潭吻鰕虎", "animal", "m"], ["澤蟹", "animal", "m"], ["沼蝦", "animal", "m"],
  ["青斑蝶", "animal", "m"], ["大紫蛺蝶", "animal", "m"], ["台灣寬尾鳳蝶", "animal", "m"], ["黃裳鳳蝶", "animal", "m"], ["台灣爺蟬", "animal", "m"],
  ["熊蟬", "animal", "m"], ["紡織娘", "animal", "m"], ["天牛", "animal", "m"], ["螳螂", "animal", "m"], ["金龜子", "animal", "m"], ["瓢蟲", "animal", "m"],
  // 植物（樹/花草/菌）
  ["紅檜", "plant", "m"], ["五葉松", "plant", "m"], ["台灣肖楠", "plant", "m"], ["鐵杉", "plant", "m"], ["冷杉", "plant", "m"],
  ["茄苳", "plant", "m"], ["樟樹", "plant", "m"], ["相思樹", "plant", "m"], ["九芎", "plant", "m"], ["台灣赤楊", "plant", "m"],
  ["山桐子", "plant", "m"], ["山枇杷", "plant", "m"], ["玉山杜鵑", "plant", "m"], ["紅毛杜鵑", "plant", "m"], ["山芙蓉", "plant", "m"],
  ["玉山金梅", "plant", "m"], ["高山沙參", "plant", "m"], ["咸豐草", "plant", "m"], ["台灣澤蘭", "plant", "m"], ["鴨跖草", "plant", "m"],
  ["通泉草", "plant", "m"], ["兔兒菜", "plant", "m"], ["山萵苣", "plant", "m"], ["靈芝", "plant", "m"], ["猴頭菇", "plant", "m"], ["珊瑚菇", "plant", "m"],
  // 器物（工具/食物/材料）
  ["木杵", "tool", "m"], ["陶罐", "tool", "m"], ["陶碗", "tool", "m"], ["竹筏", "tool", "m"], ["藤橋", "tool", "m"],
  ["獨木橋", "tool", "m"], ["背簍", "tool", "m"], ["網袋", "tool", "m"], ["火把", "tool", "m"], ["口簧琴", "tool", "m"],
  ["木梳", "tool", "m"], ["藤帽", "tool", "m"], ["樹皮衣", "tool", "m"], ["苧麻布", "tool", "m"], ["小米糕", "tool", "m"],
  ["醃魚", "tool", "m"], ["竹笛", "tool", "m"], ["石鍋", "tool", "m"], ["木盾", "tool", "m"], ["竹編", "tool", "m"],
  // 自然/地景/天氣（法術）
  ["稜線", "nature", "s"], ["埡口", "nature", "s"], ["河階", "nature", "s"], ["湧泉", "nature", "s"], ["曲流", "nature", "s"],
  ["壺穴", "nature", "s"], ["潮間帶", "nature", "s"], ["珊瑚礁", "nature", "s"], ["海蝕洞", "nature", "s"], ["積雨雲", "nature", "s"],
  ["流星雨", "nature", "s"], ["銀河", "nature", "s"], ["晚霞", "nature", "s"], ["曙光", "nature", "s"], ["崩壁", "nature", "s"],
  ["沖積扇", "nature", "s"], ["伏流", "nature", "s"], ["沙洲", "nature", "s"],
];

// ── 批次 2（~185 張，另一組真實台灣山林物，續避紅線；跨批自動去重）──
const B2_SUBJECTS = [
  // 動物（猛禽/鴞/燕雀/其他鳥）
  ["熊鷹", "animal", "m"], ["林鵰", "animal", "m"], ["蜂鷹", "animal", "m"], ["黑鳶", "animal", "m"], ["紅隼", "animal", "m"],
  ["鳳頭蒼鷹", "animal", "m"], ["台灣松雀鷹", "animal", "m"], ["黃嘴角鴞", "animal", "m"], ["褐鷹鴞", "animal", "m"], ["灰林鴞", "animal", "m"],
  ["黃魚鴞", "animal", "m"], ["綠啄木", "animal", "m"], ["大赤啄木", "animal", "m"], ["家燕", "animal", "m"], ["洋燕", "animal", "m"],
  ["白鶺鴒", "animal", "m"], ["灰鶺鴒", "animal", "m"], ["白腹鶇", "animal", "m"], ["虎鶇", "animal", "m"], ["紅嘴黑鵯", "animal", "m"],
  ["烏頭翁", "animal", "m"], ["黃胸青鶲", "animal", "m"], ["小剪尾", "animal", "m"], ["鉛色水鶇", "animal", "m"],
  // 動物（哺乳/兩棲爬蟲/魚蟹）
  ["大赤鼯鼠", "animal", "m"], ["小鼯鼠", "animal", "m"], ["刺鼠", "animal", "m"], ["台灣森鼠", "animal", "m"], ["鼴鼠", "animal", "m"],
  ["斯文豪氏攀蜥", "animal", "m"], ["中國石龍子", "animal", "m"], ["蓬萊草蜥", "animal", "m"], ["台灣滑蜥", "animal", "m"], ["鉛山壁虎", "animal", "m"],
  ["面天樹蛙", "animal", "m"], ["翡翠樹蛙", "animal", "m"], ["諸羅樹蛙", "animal", "m"], ["拉都希氏赤蛙", "animal", "m"], ["貢德氏赤蛙", "animal", "m"],
  ["腹斑蛙", "animal", "m"], ["小雨蛙", "animal", "m"], ["黑眶蟾蜍", "animal", "m"], ["高身鯝魚", "animal", "m"], ["日本禿頭鯊", "animal", "m"],
  ["鱸鰻", "animal", "m"], ["毛蟹", "animal", "m"], ["拉氏清溪蟹", "animal", "m"], ["石蟳", "animal", "m"], ["川蜷", "animal", "m"],
  // 動物（蟲）
  ["曙鳳蝶", "animal", "m"], ["大鳳蝶", "animal", "m"], ["烏鴉鳳蝶", "animal", "m"], ["青帶鳳蝶", "animal", "m"], ["紫斑蝶", "animal", "m"],
  ["端紅蝶", "animal", "m"], ["台灣騷蟬", "animal", "m"], ["草蟬", "animal", "m"], ["台灣大蝗", "animal", "m"], ["台灣長臂金龜", "animal", "m"],
  ["鹿角鍬形蟲", "animal", "m"], ["扁鍬形蟲", "animal", "m"], ["星天牛", "animal", "m"], ["埋葬蟲", "animal", "m"], ["虎甲蟲", "animal", "m"],
  ["水黽", "animal", "m"], ["龍蝨", "animal", "m"], ["豆娘", "animal", "m"], ["蜉蝣", "animal", "m"], ["台灣大蟋蟀", "animal", "m"],
  // 植物（樹/櫟楠榕）
  ["台灣紅榨槭", "plant", "m"], ["青剛櫟", "plant", "m"], ["森氏櫟", "plant", "m"], ["錐果櫟", "plant", "m"], ["台灣栲", "plant", "m"],
  ["大葉楠", "plant", "m"], ["香楠", "plant", "m"], ["江某", "plant", "m"], ["山龍眼", "plant", "m"], ["楊梅", "plant", "m"],
  ["猴歡喜", "plant", "m"], ["白匏子", "plant", "m"], ["野桐", "plant", "m"], ["羅氏鹽膚木", "plant", "m"], ["雀榕", "plant", "m"],
  ["大葉雀榕", "plant", "m"], ["水同木", "plant", "m"], ["稜果榕", "plant", "m"], ["食茱萸", "plant", "m"], ["刺蔥", "plant", "m"],
  ["台灣朴樹", "plant", "m"], ["苦楝", "plant", "m"], ["台灣欒樹", "plant", "m"], ["無患子", "plant", "m"], ["黃連木", "plant", "m"],
  ["木棉", "plant", "m"], ["刺桐", "plant", "m"], ["通脫木", "plant", "m"], ["呂宋莢蒾", "plant", "m"], ["珊瑚樹", "plant", "m"],
  // 植物（高山花草/蕨/菌）
  ["台灣龍膽", "plant", "m"], ["玉山石竹", "plant", "m"], ["玉山飛蓬", "plant", "m"], ["阿里山黃菀", "plant", "m"], ["高山藜蘆", "plant", "m"],
  ["川上氏忍冬", "plant", "m"], ["阿里山點地梅", "plant", "m"], ["尼泊爾籟簫", "plant", "m"], ["玉山圓柏", "plant", "m"], ["南湖柳葉菜", "plant", "m"],
  ["台灣桫欏", "plant", "m"], ["鳥巢蕨", "plant", "m"], ["腎蕨", "plant", "m"], ["觀音座蓮", "plant", "m"], ["崖薑蕨", "plant", "m"],
  ["伏石蕨", "plant", "m"], ["芒萁", "plant", "m"], ["烏毛蕨", "plant", "m"], ["卷柏", "plant", "m"], ["過溝菜蕨", "plant", "m"],
  ["松茸", "plant", "m"], ["雞肉絲菇", "plant", "m"], ["竹蓀", "plant", "m"], ["銀耳", "plant", "m"], ["牛肝菌", "plant", "m"], ["雲芝", "plant", "m"],
  // 器物（工具/食物/材料）
  ["藤簍", "tool", "m"], ["竹籃", "tool", "m"], ["木碗", "tool", "m"], ["木匙", "tool", "m"], ["陶甕", "tool", "m"],
  ["火鑽", "tool", "m"], ["磨石", "tool", "m"], ["石臼", "tool", "m"], ["綁腿", "tool", "m"], ["藤盾", "tool", "m"],
  ["魚叉", "tool", "m"], ["魚網", "tool", "m"], ["蝦籠", "tool", "m"], ["竹陷阱", "tool", "m"], ["穀倉", "tool", "m"],
  ["曬肉架", "tool", "m"], ["醃肉甕", "tool", "m"], ["蜂桶", "tool", "m"], ["鹽袋", "tool", "m"], ["竹管", "tool", "m"],
  ["木盤", "tool", "m"], ["藤帶", "tool", "m"], ["樹皮布", "tool", "m"], ["竹筒水", "tool", "m"], ["小米飯", "tool", "m"],
  // 自然/地景/天氣（法術）
  ["峭壁", "nature", "s"], ["岩洞", "nature", "s"], ["天然橋", "nature", "s"], ["亂石灘", "nature", "s"], ["瀑潭", "nature", "s"],
  ["幽谷", "nature", "s"], ["溪口", "nature", "s"], ["潟湖", "nature", "s"], ["浪花", "nature", "s"], ["海霧", "nature", "s"],
  ["雲瀑", "nature", "s"], ["霧淞", "nature", "s"], ["冰瀑", "nature", "s"], ["融雪", "nature", "s"], ["梅雨", "nature", "s"],
  ["午後雷陣雨", "nature", "s"], ["落山風", "nature", "s"], ["東北季風", "nature", "s"], ["日暈", "nature", "s"], ["月暈", "nature", "s"],
  ["霞光", "nature", "s"], ["星軌", "nature", "s"], ["幻日", "nature", "s"], ["山煙", "nature", "s"],
];

// ── 批次 3（~165：水鳥/猛禽/鴞、爬蟲兩棲、溪魚、蝶蟬甲蟲、高山花草）──
const B3_SUBJECTS = [
  ["黑面琵鷺", "animal", "m"], ["蒼鷺", "animal", "m"], ["大白鷺", "animal", "m"], ["中白鷺", "animal", "m"], ["黃頭鷺", "animal", "m"],
  ["綠簑鷺", "animal", "m"], ["栗小鷺", "animal", "m"], ["黃小鷺", "animal", "m"], ["紅冠水雞", "animal", "m"], ["白腹秧雞", "animal", "m"],
  ["緋秧雞", "animal", "m"], ["彩鷸", "animal", "m"], ["高蹺鴴", "animal", "m"], ["東方環頸鴴", "animal", "m"], ["磯鷸", "animal", "m"],
  ["青足鷸", "animal", "m"], ["赤足鷸", "animal", "m"], ["鷹斑鷸", "animal", "m"], ["大杓鷸", "animal", "m"], ["反嘴鴴", "animal", "m"],
  ["燕鴴", "animal", "m"], ["小燕鷗", "animal", "m"], ["鳳頭燕鷗", "animal", "m"], ["鴛鴦", "animal", "m"], ["綠頭鴨", "animal", "m"],
  ["尖尾鴨", "animal", "m"], ["琵嘴鴨", "animal", "m"], ["小水鴨", "animal", "m"], ["花嘴鴨", "animal", "m"], ["小鸊鷉", "animal", "m"],
  ["鸕鶿", "animal", "m"], ["台灣朱雀", "animal", "m"], ["灰鷽", "animal", "m"], ["煤山雀", "animal", "m"], ["赤腹山雀", "animal", "m"],
  ["黃腹琉璃", "animal", "m"], ["大卷尾", "animal", "m"], ["小卷尾", "animal", "m"], ["巨嘴鴉", "animal", "m"], ["星鴉", "animal", "m"],
  ["松鴉", "animal", "m"], ["藍磯鶇", "animal", "m"], ["白尾鴝", "animal", "m"], ["黃尾鴝", "animal", "m"], ["綠鳩", "animal", "m"],
  ["金背鳩", "animal", "m"], ["珠頸斑鳩", "animal", "m"], ["東方角鴞", "animal", "m"], ["鵂鶹", "animal", "m"], ["草鴞", "animal", "m"],
  ["雪山草蜥", "animal", "m"], ["印度蜓蜥", "animal", "m"], ["股鱗蜓蜥", "animal", "m"], ["半葉趾虎", "animal", "m"], ["短肢攀蜥", "animal", "m"],
  ["台灣龍蜥", "animal", "m"], ["黃口攀蜥", "animal", "m"], ["艾氏樹蛙", "animal", "m"], ["褐樹蛙", "animal", "m"], ["日本樹蛙", "animal", "m"],
  ["白頷樹蛙", "animal", "m"], ["台北赤蛙", "animal", "m"], ["金線蛙", "animal", "m"], ["虎皮蛙", "animal", "m"], ["古氏赤蛙", "animal", "m"],
  ["斑龜", "animal", "m"], ["食蛇龜", "animal", "m"], ["柴棺龜", "animal", "m"], ["中華鱉", "animal", "m"], ["台灣纓口鰍", "animal", "m"],
  ["台灣馬口魚", "animal", "m"], ["粗首馬口鱲", "animal", "m"], ["台灣白甲魚", "animal", "m"], ["羅漢魚", "animal", "m"], ["七星鱧", "animal", "m"],
  ["溪鱧", "animal", "m"], ["大吻鰕虎", "animal", "m"], ["極樂吻鰕虎", "animal", "m"], ["字紋弓蟹", "animal", "m"], ["粗糙沼蝦", "animal", "m"],
  ["珠光鳳蝶", "animal", "m"], ["台灣鳳蝶", "animal", "m"], ["白紋鳳蝶", "animal", "m"], ["玉帶鳳蝶", "animal", "m"], ["無尾鳳蝶", "animal", "m"],
  ["大琉璃紋鳳蝶", "animal", "m"], ["雙環鳳蝶", "animal", "m"], ["淡黃蝶", "animal", "m"], ["荷氏黃蝶", "animal", "m"], ["遷粉蝶", "animal", "m"],
  ["斯氏紫斑蝶", "animal", "m"], ["圓翅紫斑蝶", "animal", "m"], ["樺斑蝶", "animal", "m"], ["琉球青斑蝶", "animal", "m"], ["小紋青斑蝶", "animal", "m"],
  ["蟪蛄", "animal", "m"], ["薄翅蟬", "animal", "m"], ["高砂熊蟬", "animal", "m"], ["台灣大鍬形蟲", "animal", "m"], ["兩點鋸鍬形蟲", "animal", "m"],
  ["鬼豔鍬形蟲", "animal", "m"], ["深山鍬形蟲", "animal", "m"], ["圓翅鍬形蟲", "animal", "m"], ["彩虹吉丁蟲", "animal", "m"], ["白條天牛", "animal", "m"],
  ["台灣角金龜", "animal", "m"], ["寬腹螳螂", "animal", "m"], ["台灣稻蝗", "animal", "m"], ["黃斑黑蟋蟀", "animal", "m"], ["螽斯", "animal", "m"],
  ["無霸勾蜓", "animal", "m"], ["善變蜻蜓", "animal", "m"], ["杜松蜻蜓", "animal", "m"], ["短腹幽蟌", "animal", "m"], ["白痣珈蟌", "animal", "m"],
  ["黑翅螢", "animal", "m"], ["黃緣螢", "animal", "m"], ["台灣窗螢", "animal", "m"], ["刺鼠", "animal", "m"], ["高山田鼠", "animal", "m"],
  ["台灣杜鵑", "plant", "m"], ["西施花", "plant", "m"], ["玉山薔薇", "plant", "m"], ["高山白珠樹", "plant", "m"], ["玉山龍膽", "plant", "m"],
  ["黑斑龍膽", "plant", "m"], ["玉山金絲桃", "plant", "m"], ["玉山佛甲草", "plant", "m"], ["玉山蠅子草", "plant", "m"], ["玉山沙參", "plant", "m"],
  ["台灣繡線菊", "plant", "m"], ["玉山箭竹", "plant", "m"], ["包籜矢竹", "plant", "m"], ["巒大花楸", "plant", "m"], ["台灣扁核木", "plant", "m"],
  ["阿里山十大功勞", "plant", "m"], ["玉山假沙梨", "plant", "m"], ["玉山當歸", "plant", "m"], ["森氏當歸", "plant", "m"], ["台灣附地草", "plant", "m"],
  ["高山芒", "nature", "s"], ["雪坡", "nature", "s"], ["圈谷", "nature", "s"], ["碎石坡", "nature", "s"], ["高山湖泊", "nature", "s"],
  ["雲隙光", "nature", "s"], ["山雨欲來", "nature", "s"], ["午後山嵐", "nature", "s"], ["雪融溪水", "nature", "s"], ["高山寒夜", "nature", "s"],
];

// ── 批次 4（~165：喬木/灌木/藤蔓/蘭花/蕨/竹/菌苔、水生植物）──
const B4_SUBJECTS = [
  ["台灣五葉松", "plant", "m"], ["華山松", "plant", "m"], ["馬尾松", "plant", "m"], ["台灣華山松", "plant", "m"], ["紅豆杉", "plant", "m"],
  ["台灣粗榧", "plant", "m"], ["巒大杉", "plant", "m"], ["香杉", "plant", "m"], ["台灣杉木", "plant", "m"], ["柳杉", "plant", "m"],
  ["青剛櫟", "plant", "m"], ["赤皮", "plant", "m"], ["捲斗櫟", "plant", "m"], ["長尾栲", "plant", "m"], ["三斗石櫟", "plant", "m"],
  ["台灣紅豆樹", "plant", "m"], ["台灣櫸木", "plant", "m"], ["櫸", "plant", "m"], ["櫧", "plant", "m"], ["水青岡", "plant", "m"],
  ["台灣山毛櫸", "plant", "m"], ["昆欄", "plant", "m"], ["西施花木", "plant", "m"], ["假繡球", "plant", "m"], ["鵝掌藤", "plant", "m"],
  ["山胡桃", "plant", "m"], ["黃杞", "plant", "m"], ["楓楊", "plant", "m"], ["水柳", "plant", "m"], ["水社柳", "plant", "m"],
  ["台灣蘆竹", "plant", "m"], ["桂竹", "plant", "m"], ["孟宗竹", "plant", "m"], ["麻竹", "plant", "m"], ["綠竹", "plant", "m"],
  ["刺竹", "plant", "m"], ["莿竹", "plant", "m"], ["長枝竹", "plant", "m"], ["台灣矢竹", "plant", "m"], ["七弦竹", "plant", "m"],
  ["台灣一葉蘭", "plant", "m"], ["白及", "plant", "m"], ["金線蓮", "plant", "m"], ["石斛蘭", "plant", "m"], ["豆蘭", "plant", "m"],
  ["蝴蝶蘭", "plant", "m"], ["台灣蝴蝶蘭", "plant", "m"], ["風蘭", "plant", "m"], ["黃花石斛", "plant", "m"], ["綬草", "plant", "m"],
  ["台灣捲瓣蘭", "plant", "m"], ["根節蘭", "plant", "m"], ["鶴頂蘭", "plant", "m"], ["蜘蛛蘭", "plant", "m"], ["台灣金釵蘭", "plant", "m"],
  ["山蘇花", "plant", "m"], ["崖薑蕨", "plant", "m"], ["山蘇仔", "plant", "m"], ["台灣桫欏", "plant", "m"], ["筆筒樹木", "plant", "m"],
  ["觀音座蓮", "plant", "m"], ["伏石蕨", "plant", "m"], ["芒萁草", "plant", "m"], ["烏毛蕨草", "plant", "m"], ["台灣金狗毛蕨", "plant", "m"],
  ["卷柏草", "plant", "m"], ["石松", "plant", "m"], ["瓶爾小草", "plant", "m"], ["水蕨", "plant", "m"], ["槐葉蘋", "plant", "m"],
  ["台灣萍蓬草", "plant", "m"], ["台灣水韭", "plant", "m"], ["水社野牡丹", "plant", "m"], ["野薑花", "plant", "m"], ["月桃花", "plant", "m"],
  ["台灣百合", "plant", "m"], ["鐵砲百合", "plant", "m"], ["艷紅鹿子百合", "plant", "m"], ["金針花", "plant", "m"], ["台灣萱草", "plant", "m"],
  ["台灣油點草", "plant", "m"], ["黃花鼠尾草", "plant", "m"], ["台灣蝴蝶戲珠花", "plant", "m"], ["山芙蓉花", "plant", "m"], ["木芙蓉", "plant", "m"],
  ["台灣馬藍", "plant", "m"], ["大菁", "plant", "m"], ["山棕葉", "plant", "m"], ["黃藤芯", "plant", "m"], ["台灣魚藤", "plant", "m"],
  ["雞屎藤", "plant", "m"], ["野牡丹", "plant", "m"], ["杜虹花", "plant", "m"], ["台灣海棗", "plant", "m"], ["林投", "plant", "m"],
  ["月橘", "plant", "m"], ["火刺木", "plant", "m"], ["台灣火刺木", "plant", "m"], ["硃砂根", "plant", "m"], ["山黃梔", "plant", "m"],
  ["台灣繡球", "plant", "m"], ["長葉茅膏菜", "plant", "m"], ["台灣萍蓬", "plant", "m"], ["田字草", "plant", "m"], ["大安水蓑衣", "plant", "m"],
  ["靈芝木", "plant", "m"], ["珊瑚菌", "plant", "m"], ["猴板凳", "plant", "m"], ["桑黃", "plant", "m"], ["雞油菌", "plant", "m"],
  ["羊肚菌", "plant", "m"], ["松露", "plant", "m"], ["木層孔菌", "plant", "m"], ["台灣捲柏", "plant", "m"], ["土馬騌", "plant", "m"],
  ["地錢", "plant", "m"], ["大灰蘚", "plant", "m"], ["泥炭苔", "plant", "m"], ["曲尾苔", "plant", "m"], ["羽蘚", "plant", "m"],
  ["山桂花", "plant", "m"], ["馬醉木花", "plant", "m"], ["埔里杜鵑", "plant", "m"], ["守城滿山紅", "plant", "m"], ["著生杜鵑", "plant", "m"],
  ["台灣掌葉槭", "plant", "m"], ["尖葉槭", "plant", "m"], ["樟葉槭", "plant", "m"], ["台灣三角楓", "plant", "m"], ["青楓木", "plant", "m"],
  ["九芎木", "plant", "m"], ["台灣欒木", "plant", "m"], ["苦楝樹", "plant", "m"], ["茄苳樹", "plant", "m"], ["雀榕木", "plant", "m"],
  ["白榕", "plant", "m"], ["正榕", "plant", "m"], ["黃槿", "plant", "m"], ["水黃皮", "plant", "m"], ["台灣海桐", "plant", "m"],
  ["草海桐", "plant", "m"], ["文珠蘭", "plant", "m"], ["濱刀豆", "plant", "m"], ["馬鞍藤", "plant", "m"], ["林投果", "plant", "m"],
];

// ── 批次 5（~165：地景/地形/天氣/星空、材質文化/器物/食物/工藝、溪海）──
const B5_SUBJECTS = [
  ["岩壁", "nature", "s"], ["峭岩", "nature", "s"], ["石瀑", "nature", "s"], ["巨石堆", "nature", "s"], ["天坑", "nature", "s"],
  ["石灰岩洞", "nature", "s"], ["鐘乳石", "nature", "s"], ["溫泉煙", "nature", "s"], ["硫氣孔", "nature", "s"], ["泥火山", "nature", "s"],
  ["堰塞湖", "nature", "s"], ["瀑布群", "nature", "s"], ["跌水", "nature", "s"], ["急湍", "nature", "s"], ["漩渦", "nature", "s"],
  ["回水潭", "nature", "s"], ["礫石河床", "nature", "s"], ["曲流頸", "nature", "s"], ["牛軛湖", "nature", "s"], ["三角洲", "nature", "s"],
  ["海階", "nature", "s"], ["海崖", "nature", "s"], ["海蝕平台", "nature", "s"], ["礁岩", "nature", "s"], ["海蝕溝", "nature", "s"],
  ["潮池", "nature", "s"], ["浪濤", "nature", "s"], ["湧浪", "nature", "s"], ["退潮", "nature", "s"], ["漲潮", "nature", "s"],
  ["海風", "nature", "s"], ["山谷風", "nature", "s"], ["谷地霧", "nature", "s"], ["輻射霧", "nature", "s"], ["平流霧", "nature", "s"],
  ["朝霧散", "nature", "s"], ["雲隙", "nature", "s"], ["積雲", "nature", "s"], ["層雲", "nature", "s"], ["卷積雲", "nature", "s"],
  ["莢狀雲", "nature", "s"], ["旗雲", "nature", "s"], ["火燒雲", "nature", "s"], ["夕燒", "nature", "s"], ["朝燒", "nature", "s"],
  ["虹暈", "nature", "s"], ["環天頂弧", "nature", "s"], ["日柱", "nature", "s"], ["月華", "nature", "s"], ["星團", "nature", "s"],
  ["流星群", "nature", "s"], ["夏季大三角", "nature", "s"], ["南十字", "nature", "s"], ["晨星", "nature", "s"], ["晚星", "nature", "s"],
  ["驟雨", "nature", "s"], ["雷陣雨", "nature", "s"], ["連綿細雨", "nature", "s"], ["山風呼嘯", "nature", "s"], ["寒露", "nature", "s"],
  ["結霜", "nature", "s"], ["薄冰", "nature", "s"], ["冰晶", "nature", "s"], ["雪霰", "nature", "s"], ["粉雪", "nature", "s"],
  ["木杓", "tool", "m"], ["木盆", "tool", "m"], ["竹匙", "tool", "m"], ["竹筷", "tool", "m"], ["陶壺水", "tool", "m"],
  ["石板灶", "tool", "m"], ["三石灶", "tool", "m"], ["火鉗", "tool", "m"], ["火塘灰", "tool", "m"], ["燻架", "tool", "m"],
  ["竹樓", "tool", "m"], ["茅屋頂", "tool", "m"], ["石板牆", "tool", "m"], ["穀倉柱", "tool", "m"], ["望樓", "tool", "m"],
  ["藤梯", "tool", "m"], ["竹橋", "tool", "m"], ["繩橋", "tool", "m"], ["水車", "tool", "m"], ["石堰", "tool", "m"],
  ["竹筧", "tool", "m"], ["竹水管", "tool", "m"], ["魚梁", "tool", "m"], ["石滬", "tool", "m"], ["竹籠陷阱", "tool", "m"],
  ["套索", "tool", "m"], ["彈弓", "tool", "m"], ["投石索", "tool", "m"], ["竹弓箭", "tool", "m"], ["木矛", "tool", "m"],
  ["藤編盔", "tool", "m"], ["皮甲", "tool", "m"], ["樹皮帽", "tool", "m"], ["草鞋", "tool", "m"], ["綁腿布", "tool", "m"],
  ["苧麻繩", "tool", "m"], ["麻線團", "tool", "m"], ["紡錘", "tool", "m"], ["織布機", "tool", "m"], ["整經架", "tool", "m"],
  ["染料缸", "tool", "m"], ["薯榔染", "tool", "m"], ["九芎炭", "tool", "m"], ["木炭", "tool", "m"], ["火種罐", "tool", "m"],
  ["小米穗", "tool", "m"], ["紅藜", "tool", "m"], ["樹豆莢", "tool", "m"], ["山芋", "tool", "m"], ["山藥", "tool", "m"],
  ["樹薯", "tool", "m"], ["芋頭", "tool", "m"], ["地瓜", "tool", "m"], ["糯小米", "tool", "m"], ["小米糰", "tool", "m"],
  ["竹筒飯團", "tool", "m"], ["月桃粽", "tool", "m"], ["假酸漿葉", "tool", "m"], ["吉拿富", "tool", "m"], ["阿拜", "tool", "m"],
  ["醃山肉", "tool", "m"], ["風乾魚", "tool", "m"], ["蜂蜜罐", "tool", "m"], ["山鹽", "tool", "m"], ["馬告粒", "tool", "m"],
  ["刺蔥葉", "tool", "m"], ["山胡椒果", "tool", "m"], ["香蕉葉包", "tool", "m"], ["竹杯酒", "tool", "m"], ["連杯", "tool", "m"],
  ["木臼杵", "tool", "m"], ["石磨盤", "tool", "m"], ["篩子", "tool", "m"], ["簸箕", "tool", "m"], ["穀耙", "tool", "m"],
  ["漁筌", "tool", "m"], ["魚簍網", "tool", "m"], ["蝦籠竹", "tool", "m"], ["八卦網", "tool", "m"], ["撒網", "tool", "m"],
  ["竹排筏", "tool", "m"], ["樹皮舟", "tool", "m"], ["木槳", "tool", "m"], ["竹篙", "tool", "m"], ["浮標", "tool", "m"],
];

const SUBJECT_BATCHES = [B1_SUBJECTS, B2_SUBJECTS, B3_SUBJECTS, B4_SUBJECTS, B5_SUBJECTS];

// 隨從數值曲線：總值 ≈ cost*2+1，攻守均分。關鍵字微調（嘲諷偏血、衝鋒/突襲偏攻且少 1 總值）。
function minionStats(cost, kw) {
  let total = cost * 2 + 1;
  if (kw === "charge" || kw === "rush" || kw === "windfury") total -= 1;
  let atk = Math.round(total / 2);
  let hp = total - atk;
  if (kw === "taunt" || kw === "divineShield") { hp += 1; atk = Math.max(1, atk - 1); }
  return { atk: Math.max(1, atk), hp: Math.max(1, hp) };
}

const THEME_ZH_MD = { animal: "動物", plant: "植物", nature: "自然", tool: "器物", legend: "傳說" };
const KW_TEXT = { taunt: "嘲諷", stealth: "潛行", charge: "衝鋒", rush: "突襲", divineShield: "石鎧", lifesteal: "汲取", windfury: "疾風" };
// 各主題可帶的關鍵字池（含 null=無關鍵字的普通隨從）。
const KW_BY_THEME = {
  animal: [null, "charge", "rush", "stealth", "windfury", null],
  plant: [null, "taunt", "divineShield", "taunt", null, null],
  tool: [null, "lifesteal", "taunt", "divineShield", null, null],
};

// 法術：直接沿用現有已知可運作的 (effect, 文字, 加成) 組合，只換名字/主題，確保加成機制正確。
const SPELL_KINDS = [
  { cost: 1, effect: "buffFriend11", text: "給一個友方隨從 +1/+1", bonus: "改為 +2/+2" },
  { cost: 2, effect: "dmgEnemyMinion3", text: "對一個敵方隨從造成 3 點傷害", bonus: "改為 4 點" },
  { cost: 3, effect: "aoeEnemy2", text: "對所有敵方隨從造成 2 點傷害", bonus: "改為 3 點" },
  { cost: 3, effect: "draw2", text: "抽 2 張牌", bonus: "再抽 1 張" },
  { cost: 3, effect: "dmgMinion4", text: "對一個隨從造成 4 點傷害", bonus: "改為 5 點" },
  { cost: 4, effect: "dmgAny5", text: "造成 5 點傷害（任一目標）", bonus: "改為 6 點" },
  { cost: 4, effect: "healHero5", text: "回復我方英雄 5 點", bonus: "額外抽 1 張" },
  { cost: 5, effect: "aoeEnemy3", text: "對所有敵方隨從造成 3 點傷害", bonus: "改為 4 點" },
];

// 稀有度：多數普通、部分稀有、少量史詩；不自動生成傳說。
function rarityFor(i) {
  const r = i % 15;
  if (r === 0) return "epic";
  if (r <= 4) return "rare";
  return "common";
}

// 學習小註（每張卡都需要；簡短、準確、非神聖題材）。
const LEARN_BY_THEME = {
  animal: (n) => `「${n}」是台灣山林裡的動物，從生態觀察認識牠。`,
  plant: (n) => `「${n}」是台灣山林的植物，從山林植被認識牠。`,
  nature: (n) => `「${n}」是山林中的自然現象與地景，學自然與地形的語感。`,
  tool: (n) => `「${n}」是山林生活的器物或食材，連到日常生活脈絡。`,
};

const cards = [];
const learn = {};
const batchOf = {}; // id -> 批次索引（供 MD 分批）
const seen = new Set(); // 跨批去重
let mi = 0, si = 0, vi = 0, pos = 0;
// 攤平所有批次，用全域位置 pos 決定 id（批次1順序不變＝id 穩定，不擾動已生的圖）。
SUBJECT_BATCHES.forEach((batch, bi) => {
  batch.forEach((sub) => {
    const idx = pos++;
    const [name, theme, kind] = sub;
    if (existing.has(name) || seen.has(name)) return; // 對現有＋跨批去重
    seen.add(name);
    const id = `gen-${String(idx + 1).padStart(4, "0")}`;
    batchOf[id] = bi;
    const vocabId = vocabIds[vi++ % vocabIds.length];
    const rarity = rarityFor(idx);
    learn[id] = (LEARN_BY_THEME[theme] ?? LEARN_BY_THEME.nature)(name);
    if (kind === "s") {
      const k = SPELL_KINDS[si++ % SPELL_KINDS.length];
      cards.push({ id, nameZh: name, type: "spell", cost: k.cost, rarity, theme, vocabId, effect: k.effect, effectText: k.text, bonusText: k.bonus });
    } else {
      const costPattern = [2, 1, 3, 2, 4, 3, 2, 5, 4, 3, 6, 2, 4, 7, 3];
      const cost = costPattern[mi % costPattern.length];
      const kwPool = KW_BY_THEME[theme] ?? [null];
      const kw = kwPool[mi % kwPool.length];
      mi++;
      const { atk, hp } = minionStats(cost, kw);
      const card = { id, nameZh: name, type: "minion", cost, attack: atk, health: hp, rarity, theme, vocabId,
        effectText: kw ? KW_TEXT[kw] : "—",
        bonusText: kw === "taunt" ? "+0/+2" : "+1/+1",
        bonusStats: kw === "taunt" ? { atk: 0, hp: 2 } : { atk: 1, hp: 1 } };
      if (kw) card.keywords = [kw];
      cards.push(card);
    }
  });
});

writeFileSync("src/data/cards.generated.json", JSON.stringify(cards, null, 2) + "\n");
writeFileSync("src/data/cardLearning.generated.json", JSON.stringify(learn, null, 2) + "\n");

// ── 美術生成 MD（給 Codex 生圖用）：每張一列，含檔名與美術提示 ──
const STYLE = "厚塗寫實／水彩感的台灣山林插畫，5:7 直式，構圖飽滿，無文字、無邊框、無浮水印。";
const GUARD = "不畫人形、不畫神聖器物或祭儀場景、不畫百步蛇。";
function artPrompt(name, theme) {
  const body = {
    animal: `一隻「${name}」在牠的自然棲地（溪流／森林／草叢），晨光與山霧的台灣山林背景`,
    plant: `「${name}」的植株特寫，襯台灣山林地景與自然光影`,
    nature: `「${name}」的台灣山林地景或天氣景象，開闊有氣勢`,
    tool: `山林生活的器物「${name}」（木／竹／藤／獸皮／陶等材質）的靜物特寫，襯部落生活地景`,
  }[theme] ?? `「${name}」的台灣山林意象`;
  return `${body}。${STYLE}${GUARD}`;
}
// 手寫傳說卡（art-less）每批的美術列；提示謹守地景/自然、不畫人形。實際卡定義在 cards.ts。
const LEGEND_BATCHES = [
  [
    ["leg-l34", "飛魚報汛", `隨黑潮而來的飛魚群躍出海面，遠方是蘭嶼海岸線的清晨；${STYLE}只畫魚群與海景，不畫人形、不涉祭儀。`],
    ["leg-l35", "拼板舟", `一艘達悟族傳統拼板舟停在礫石海灘，船身有紅白黑幾何彩繪，背景晨光海岸；${STYLE}只畫船體工藝與海景，不畫人形、不涉下水祭儀。`],
    ["leg-l36", "銜穀種的鳥", `一隻小鳥口銜一串飽滿穀穗，飛越山田上空，晨光地景；${STYLE}只畫鳥與穀穗，不畫人形。`],
    ["leg-l37", "避洪的玉山", `大水漫過谷地、遠處玉山高峰露出雲海之上的地景，光線由陰轉晴；${STYLE}只畫高山避洪的地景，不畫人形。`],
    ["leg-l38", "楓紅的山", `深秋滿山楓紅的台灣中海拔山林，葉片隨風飄落，層層山巒；${STYLE}只畫楓紅地景，不畫人形。`],
  ],
  [
    ["leg-l39", "熊與豹的紋身", `台灣黑熊與雲豹在森林中相對，黑熊胸前有白色 V 紋、雲豹身上有雲狀斑，晨光林間；${STYLE}只畫兩隻動物，不畫人形。`],
    ["leg-l40", "穿山甲與猴子", `一隻穿山甲蜷起鱗甲、一隻台灣獼猴在旁的森林地景，落葉與樹根；${STYLE}只畫兩隻動物，不畫人形。`],
    ["leg-l41", "追逐的日月", `天空中日與月一前一後、晝夜交界的山稜地景，霞光過渡；${STYLE}只畫日月與山稜天象，不畫人形。`],
  ],
  [
    ["leg-l42", "取火的動物", `一隻小動物口銜火種、涉過溪流帶回山林，火光映在水面與夜色山林；${STYLE}只畫動物與火光，不畫人形。`],
  ],
  [
    ["leg-l43", "洪水中的浮木", `大洪水中一段漂流的巨木浮在濁浪上、遠山露出水面的地景，光線由陰轉晴；${STYLE}只畫洪水與漂木地景，不畫人形。`],
  ],
];
// 拆成小塊（每檔 CHUNK 張）——Codex 一次吃太多會當機，小塊比較穩。放 docs/card-art/。
const CHUNK = 30;
const OUT = "docs/card-art";
mkdirSync(OUT, { recursive: true });
const HEAD = `給 Codex／繪圖：請依下表生成卡面圖。**風格統一**：${STYLE}**文化框限**：${GUARD}\n**輸出**：每張存成 \`public/images/cards/<檔名>\`。**已有同名檔就跳過**（可續生、不重做）。生完通知工程端登錄 \`CARD_ART\`。`;
const TABLE_HEAD = `| id | 卡名 | 主題 | 類型 | 檔名 | 美術提示 |\n|----|------|------|------|------|----------|`;
const index = [
  "# 峽谷行者 · 卡面美術任務清單（分小塊）",
  "",
  `全部拆成每檔 ${CHUNK} 張的小塊，Codex 一次做一檔即可（不會過載）。每張存 \`public/images/cards/<id>.jpg\`；`,
  "**已存在同名檔就跳過**（可續生）。整體進度與規格見 `docs/card-art-status-report.md`。",
  "",
  "| 小塊檔 | 批次 | 張數 |",
  "|--------|------|------|",
];
SUBJECT_BATCHES.forEach((_, bi) => {
  const genRows = cards.filter((c) => batchOf[c.id] === bi)
    .map((c) => `| ${c.id} | ${c.nameZh} | ${THEME_ZH_MD[c.theme]} | ${c.type === "spell" ? "法術" : "隨從"} | ${c.id}.jpg | ${artPrompt(c.nameZh, c.theme)} |`);
  const legRows = (LEGEND_BATCHES[bi] ?? []).map(([id, name, p]) => `| ${id} | ${name} | 傳說 | — | ${id}.jpg | ${p} |`);
  const rows = [...legRows, ...genRows];
  for (let p = 0; p * CHUNK < rows.length; p++) {
    const part = rows.slice(p * CHUNK, (p + 1) * CHUNK);
    const pp = String(p + 1).padStart(2, "0");
    const fname = `batch-${bi + 1}-part-${pp}.md`;
    const md = `# 卡面美術 · 批次 ${bi + 1} · 第 ${p + 1} 塊（${part.length} 張）\n\n${HEAD}\n\n${TABLE_HEAD}\n${part.join("\n")}\n`;
    writeFileSync(`${OUT}/${fname}`, md);
    index.push(`| \`${fname}\` | ${bi + 1} | ${part.length} |`);
  }
});
writeFileSync(`${OUT}/README.md`, index.join("\n") + "\n");
const byRarity = cards.reduce((a, c) => ((a[c.rarity] = (a[c.rarity] || 0) + 1), a), {});
const byType = cards.reduce((a, c) => ((a[c.type] = (a[c.type] || 0) + 1), a), {});
console.log(`生成 ${cards.length} 張（去重後）| 型別 ${JSON.stringify(byType)} | 稀有度 ${JSON.stringify(byRarity)}`);
