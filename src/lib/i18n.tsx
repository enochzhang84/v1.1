import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "zh" | "en";

const STORAGE_KEY = "hoc3.lang";

// 统一的翻译字典 — 新增文案在此添加 key 即可
export const translations = {
  // 后台标题
  appTitle: { zh: "基督三家 事工中心", en: "HOC3 Ministry Center" },
  appSubtitle: { zh: "HOC3 Ministry Center", en: "基督三家 事工中心" },

  // 顶部按钮
  contacts: { zh: "通讯录", en: "Contacts" },
  hoc3Home: { zh: "基督三家主页", en: "HOC3 Home" },
  manualEntry: { zh: "手动录入", en: "Manual Entry" },
  logout: { zh: "退出", en: "Sign out" },
  readOnly: { zh: "只读模式", en: "Read-only" },
  workerLabel: { zh: "同工", en: "Worker" },
  viewerLabel: { zh: "访客", en: "Viewer" },

  // 模块 / Tab
  modReports: { zh: "数据统计", en: "Reports" },
  modWelcome: { zh: "迎宾接待", en: "Welcome Ministry" },
  modMedia: { zh: "影音投影", en: "Media Ministry" },
  modKitchen: { zh: "厨房事工", en: "Kitchen Ministry" },
  modSundaySchool: { zh: "主日学", en: "Sunday School" },
  modFellowship: { zh: "团契与小组", en: "Fellowship & Groups" },
  modEvents: { zh: "活动", en: "Events" },
  modNewcomer: { zh: "新人登记", en: "Newcomer Registration" },
  modRetreat: { zh: "退修会", en: "Retreat" },
  modTvDisplay: { zh: "TV 数字标牌", en: "TV Display" },
  modChat: { zh: "同工聊天", en: "Team Chat" },
  modUsers: { zh: "用户管理", en: "User Management" },

  // 语言切换
  langZh: { zh: "中文", en: "中文" },
  langEn: { zh: "English", en: "English" },

  // Reports — sub tabs
  rptOverview: { zh: "概览", en: "Overview" },
  rptNewcomer: { zh: "新人", en: "Newcomers" },
  rptSunday: { zh: "主日学", en: "Sunday School" },
  rptMeals: { zh: "饭食", en: "Meals" },
  rptService: { zh: "服侍", en: "Service" },
  rptBaptism: { zh: "决志受洗", en: "Baptism & Decisions" },
  rptAnnual: { zh: "年度报告", en: "Annual Report" },

  // Reports — overview cards
  cardSundayAttendance: { zh: "主日出席人数", en: "Sunday Attendance" },
  cardNewcomers: { zh: "新人数量", en: "Newcomers" },
  cardLongAbsence: { zh: "长期缺席人数", en: "Long-term Absences" },
  cardFellowshipRate: { zh: "团契参与率", en: "Fellowship Participation" },
  cardSundayRate: { zh: "主日学参与率", en: "Sunday School Participation" },
  cardAnnualBaptism: { zh: "年度受洗人数", en: "Annual Baptisms" },
  cardAnnualService: { zh: "年度服侍人数", en: "Annual Service Members" },
  cardRetreatRegs: { zh: "退修会报名人数", en: "Retreat Registrations" },

  // Reports — card sub-text
  subLatestWorship: { zh: "最近一次崇拜", en: "Latest Worship Service" },
  subYearTotal: { zh: "年累计", en: " Total" },
  subAbsence4w: { zh: "团契超4周未签到", en: "No fellowship check-in for 4+ weeks" },
  subLast4w: { zh: "近4周", en: "Last 4 weeks" },
  subPeople: { zh: "人", en: "" },
  subYearDecision: { zh: "年 决志", en: " Decisions: " },
  subYearWorkers: { zh: "年同工", en: " Workers" },
  subTotalRegs: { zh: "累计报名", en: "Total Registrations" },

  // Welcome 二级
  subGreet: { zh: "迎宾", en: "Greeting" },
  subReception: { zh: "接待", en: "Reception" },

  // Media 二级
  subLive: { zh: "聚会直播", en: "Live Service" },
  subScreen: { zh: "屏幕管理", en: "Screen Management" },
  subMinistry: { zh: "主日轮值", en: "Sunday Rotation" },
  subEmergency: { zh: "紧急事件", en: "Emergencies" },

  // Kitchen 二级
  subDining: { zh: "就餐人数统计", en: "Dining Headcount" },
  subSundayMeal: { zh: "主日订餐计划", en: "Sunday Meal Plan" },
  subEventMeal: { zh: "其他活动订餐记事本", en: "Event Meal Notebook" },
  subKitchenService: { zh: "事工服侍", en: "Ministry Service" },
  subMealsStats: { zh: "餐食统计", en: "Meals Statistics" },

  // Sunday School 二级
  subAdultSS: { zh: "成人主日学", en: "Adult Sunday School" },
  subKidsSS: { zh: "儿童主日学", en: "Children's Sunday School" },
} as const satisfies Record<string, Record<Lang, string>>;

export type TKey = keyof typeof translations;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "zh" || saved === "en") setLangState(saved);
    } catch {/* ignore */}
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {/* ignore */}
  };

  const t = (k: TKey) => translations[k][lang] ?? translations[k].zh;

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // 兜底：未挂载 Provider 时仍然可用（默认中文）
    return {
      lang: "zh",
      setLang: () => {},
      t: (k: TKey) => translations[k].zh,
    };
  }
  return ctx;
}