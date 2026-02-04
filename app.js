/*
  Skybound Cultivation Academy
  - Pure update functions manage state changes
  - Render functions map state -> UI
  - Event handlers orchestrate inputs and persistence
*/

const REALMS = [
  "Qi Refining",
  "Foundation",
  "Core",
  "Nascent",
  "Ascension"
];

const REALM_THRESHOLDS = [0, 120, 260, 430, 640];

const OUTCOME_OPTIONS = {
  homework: ["Yes", "No"],
  correction: ["Yes", "No"],
  quiz: ["Excellent", "Good", "Pass", "Needs Fix"],
  exam: ["Excellent", "Good", "Pass", "Needs Fix"],
  contest: ["Participated", "Placed", "Won"],
  focus: ["Low", "Medium", "High"]
};

const EXCHANGE_OPTIONS = [
  {
    id: "boost_points",
    name: "Cultivation Surge",
    description: "+15 Cultivation Points",
    cost: 1,
    apply: (student) => {
      student.cultivationPoints += 15;
    }
  },
  {
    id: "spirit_pool",
    name: "Spirit Wellspring",
    description: "+10 Spirit Max (and refill)",
    cost: 2,
    apply: (student) => {
      student.spirit.max += 10;
      student.spirit.current = student.spirit.max;
    }
  },
  {
    id: "power_sigil",
    name: "Power Sigil",
    description: "+5 Recent Power cap",
    cost: 2,
    apply: (student) => {
      student.recentPowerCap += 5;
      student.recentPower = Math.min(student.recentPower + 2, student.recentPowerCap);
    }
  }
];

const ACHIEVEMENTS = [
  {
    id: "homework_streak",
    name: "Seven-Day Homework Streak",
    description: "Submit homework 7 times in a row.",
    isUnlocked: (student) => student.habits.homeworkStreak >= 7
  },
  {
    id: "correction_week",
    name: "Meridian Adjustments",
    description: "Complete 3 corrections within 7 days.",
    isUnlocked: (student) => countRecent(student.history, "correction_yes", 7) >= 3
  },
  {
    id: "comeback",
    name: "Comeback",
    description: "Improve a quiz or exam tier over the last one.",
    isUnlocked: (student) => student.habits.comebackAchieved
  },
  {
    id: "courage",
    name: "Courage",
    description: "Participate in a contest.",
    isUnlocked: (student) => student.habits.contestJoined
  },
  {
    id: "consistency",
    name: "Consistency",
    description: "Maintain 85% homework completion rate (10+ entries).",
    isUnlocked: (student) =>
      student.habits.homeworkTotal >= 10 &&
      student.habits.homeworkCompletionRate >= 0.85
  },
  {
    id: "focus_master",
    name: "Focused Breath",
    description: "Record 5 high-focus moments within 7 days.",
    isUnlocked: (student) => countRecent(student.history, "focus_high", 7) >= 5
  },
  {
    id: "journal_adept",
    name: "Dao Journal Adept",
    description: "Add 3 Dao Journal insights.",
    isUnlocked: (student) => student.daoJournal.insights >= 3
  },
  {
    id: "realm_break",
    name: "Breakthrough",
    description: "Reach the Foundation realm or higher.",
    isUnlocked: (student) => student.realmIndex >= 1
  }
];

const initialState = {
  students: [
    {
      id: "s1",
      name: "Lian",
      sect: "Cloud Gate",
      realmIndex: 0,
      realmProgress: 0,
      cultivationPoints: 40,
      spirit: { current: 32, max: 40 },
      recentPower: 12,
      recentPowerCap: 30,
      habits: {
        homeworkStreak: 0,
        correctionCount: 0,
        homeworkTotal: 0,
        homeworkCompleted: 0,
        homeworkCompletionRate: 0,
        comebackAchieved: false,
        contestJoined: false
      },
      achievementsUnlocked: [],
      tokens: 1,
      inventory: ["Focus Charm"],
      daoJournal: { insights: 0, meter: 0, meterMax: 5 },
      lastAssessmentTier: null,
      history: []
    },
    {
      id: "s2",
      name: "Jun",
      sect: "River Lanterns",
      realmIndex: 0,
      realmProgress: 0,
      cultivationPoints: 70,
      spirit: { current: 28, max: 38 },
      recentPower: 14,
      recentPowerCap: 28,
      habits: {
        homeworkStreak: 0,
        correctionCount: 0,
        homeworkTotal: 0,
        homeworkCompleted: 0,
        homeworkCompletionRate: 0,
        comebackAchieved: false,
        contestJoined: false
      },
      achievementsUnlocked: [],
      tokens: 0,
      inventory: ["Steady Breath Band"],
      daoJournal: { insights: 0, meter: 0, meterMax: 5 },
      lastAssessmentTier: null,
      history: []
    },
    {
      id: "s3",
      name: "Mei",
      sect: "Sun Ember",
      realmIndex: 0,
      realmProgress: 0,
      cultivationPoints: 25,
      spirit: { current: 30, max: 36 },
      recentPower: 10,
      recentPowerCap: 26,
      habits: {
        homeworkStreak: 0,
        correctionCount: 0,
        homeworkTotal: 0,
        homeworkCompleted: 0,
        homeworkCompletionRate: 0,
        comebackAchieved: false,
        contestJoined: false
      },
      achievementsUnlocked: [],
      tokens: 0,
      inventory: ["Curiosity Scroll"],
      daoJournal: { insights: 0, meter: 0, meterMax: 5 },
      lastAssessmentTier: null,
      history: []
    }
  ],
  logs: []
};

let state = deepCopy(initialState);

const elements = {
  studentSelect: document.getElementById("student-select"),
  recordType: document.getElementById("record-type"),
  recordOutcome: document.getElementById("record-outcome"),
  recordOutcomeLabel: document.getElementById("record-outcome-label"),
  recordNote: document.getElementById("record-note"),
  recordForm: document.getElementById("record-form"),
  daoJournal: document.getElementById("dao-journal"),
  studentCards: document.getElementById("student-cards"),
  achievementList: document.getElementById("achievement-list"),
  exchangeOptions: document.getElementById("exchange-options"),
  logEntries: document.getElementById("log-entries"),
  saveBtn: document.getElementById("save-btn"),
  loadBtn: document.getElementById("load-btn"),
  resetBtn: document.getElementById("reset-btn")
};

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function getStudentById(studentId, data = state) {
  return data.students.find((student) => student.id === studentId);
}

function addLogEntry(message, studentName) {
  state.logs.unshift({
    time: new Date().toLocaleString(),
    message,
    studentName
  });
  state.logs = state.logs.slice(0, 20);
}

function countRecent(history, type, days) {
  const now = Date.now();
  const windowMs = days * 24 * 60 * 60 * 1000;
  return history.filter((entry) => entry.type === type && now - entry.time <= windowMs).length;
}

function calculateRealm(cultivationPoints) {
  let realmIndex = 0;
  for (let i = 0; i < REALM_THRESHOLDS.length; i += 1) {
    if (cultivationPoints >= REALM_THRESHOLDS[i]) {
      realmIndex = i;
    }
  }
  const current = REALM_THRESHOLDS[realmIndex];
  const next = REALM_THRESHOLDS[realmIndex + 1];
  const progress = next
    ? Math.floor(((cultivationPoints - current) / (next - current)) * 100)
    : 100;

  return { realmIndex, realmProgress: Math.min(progress, 100) };
}

function normalizeState(data) {
  data.students.forEach((student) => {
    const realmInfo = calculateRealm(student.cultivationPoints);
    student.realmIndex = realmInfo.realmIndex;
    student.realmProgress = realmInfo.realmProgress;
    student.spirit.current = Math.min(student.spirit.current, student.spirit.max);
    student.recentPower = Math.min(student.recentPower, student.recentPowerCap);
  });
}

function applyRealmUpdate(student, previousRealmIndex) {
  const realmInfo = calculateRealm(student.cultivationPoints);
  student.realmIndex = realmInfo.realmIndex;
  student.realmProgress = realmInfo.realmProgress;

  if (student.realmIndex > previousRealmIndex) {
    student.breakthrough = true;
    addLogEntry(
      `Meridians stabilize — breakthrough into ${REALMS[student.realmIndex]}!`,
      student.name
    );
  }
}

function applyRecentPower(student, amount) {
  student.recentPower = Math.min(student.recentPower + amount, student.recentPowerCap);
}

function applySpirit(student, amount) {
  student.spirit.current = Math.min(student.spirit.current + amount, student.spirit.max);
}

function applyDaoJournal(student) {
  student.daoJournal.insights += 1;
  student.daoJournal.meter = Math.min(student.daoJournal.meter + 1, student.daoJournal.meterMax);
  applySpirit(student, 4);
  if (student.daoJournal.meter >= student.daoJournal.meterMax) {
    student.daoJournal.meter = 0;
    student.cultivationPoints += 10;
    addLogEntry("Dao Journal complete — insight blooms. +10 Cultivation Points.", student.name);
  }
}

function updateHomework(student, outcome) {
  student.habits.homeworkTotal += 1;
  if (outcome === "Yes") {
    student.cultivationPoints += 6;
    student.habits.homeworkStreak += 1;
    student.habits.homeworkCompleted += 1;
    applyRecentPower(student, 1);
    addLogEntry(
      "Submitted homework with steady breath. +6 Cultivation Points.",
      student.name
    );
  } else {
    student.habits.homeworkStreak = 0;
    student.cultivationPoints += 2;
    addLogEntry(
      "Paused on homework. A gentle reminder to return tomorrow. +2 Cultivation Points.",
      student.name
    );
  }
}

function updateCorrection(student, outcome) {
  if (outcome === "Yes") {
    student.cultivationPoints += 8;
    student.habits.correctionCount += 1;
    applyRecentPower(student, 2);
    addLogEntry(
      "Completed corrections — meridians aligned. +8 Cultivation Points.",
      student.name
    );
  } else {
    student.cultivationPoints += 3;
    addLogEntry(
      "Plans to revisit corrections soon. +3 Cultivation Points.",
      student.name
    );
  }
}

function tierValue(tier) {
  switch (tier) {
    case "Excellent":
      return 4;
    case "Good":
      return 3;
    case "Pass":
      return 2;
    default:
      return 1;
  }
}

function updateAssessment(student, type, tier) {
  const tierPoints = {
    Excellent: 18,
    Good: 14,
    Pass: 10,
    "Needs Fix": 6
  };
  const powerBoost = {
    Excellent: 6,
    Good: 4,
    Pass: 3,
    "Needs Fix": 1
  };
  student.cultivationPoints += tierPoints[tier];
  applyRecentPower(student, powerBoost[tier]);
  applySpirit(student, 2);

  const previousTierValue = student.lastAssessmentTier ?? 0;
  const currentTierValue = tierValue(tier);
  if (currentTierValue > previousTierValue && previousTierValue > 0) {
    student.habits.comebackAchieved = true;
  }
  student.lastAssessmentTier = currentTierValue;

  const encouragement = tier === "Needs Fix"
    ? "A calm breath and a correction session will strengthen the path."
    : "Momentum rises with each careful step.";

  addLogEntry(
    `Completed a ${type} with a ${tier} result. ${encouragement}`,
    student.name
  );
}

function updateContest(student, outcome) {
  const contestPoints = {
    Participated: 12,
    Placed: 18,
    Won: 24
  };
  student.cultivationPoints += contestPoints[outcome];
  applyRecentPower(student, outcome === "Won" ? 8 : 5);
  student.habits.contestJoined = true;
  addLogEntry(
    `${outcome === "Participated" ? "Joined" : outcome === "Placed" ? "Placed in" : "Won"} a contest. Courage shines.`,
    student.name
  );
}

function updateFocus(student, outcome) {
  const focusPoints = {
    Low: 2,
    Medium: 4,
    High: 6
  };
  student.cultivationPoints += focusPoints[outcome];
  if (outcome === "High") {
    student.history.push({ time: Date.now(), type: "focus_high" });
  }
  applySpirit(student, outcome === "High" ? 4 : 2);
  addLogEntry(
    `Showed ${outcome.toLowerCase()} focus in class. +${focusPoints[outcome]} Cultivation Points.`,
    student.name
  );
}

function updateHomeworkCompletionRate(student) {
  if (student.habits.homeworkTotal > 0) {
    student.habits.homeworkCompletionRate =
      student.habits.homeworkCompleted / student.habits.homeworkTotal;
  }
}

function unlockAchievements(student) {
  ACHIEVEMENTS.forEach((achievement) => {
    if (!student.achievementsUnlocked.includes(achievement.id) && achievement.isUnlocked(student)) {
      student.achievementsUnlocked.push(achievement.id);
      student.tokens += 1;
      addLogEntry(
        `Unlocked achievement: ${achievement.name}. +1 Achievement Token.`,
        student.name
      );
    }
  });
}

function applyRecord(studentId, recordType, outcome, note, includeDaoJournal) {
  const student = getStudentById(studentId);
  if (!student) return;

  const previousRealmIndex = student.realmIndex;
  student.history.push({ time: Date.now(), type: recordType, detail: outcome, note });

  switch (recordType) {
    case "homework":
      updateHomework(student, outcome);
      break;
    case "correction":
      updateCorrection(student, outcome);
      if (outcome === "Yes") {
        student.history.push({ time: Date.now(), type: "correction_yes" });
      }
      break;
    case "quiz":
      updateAssessment(student, "quiz", outcome);
      break;
    case "exam":
      updateAssessment(student, "exam", outcome);
      break;
    case "contest":
      updateContest(student, outcome);
      break;
    case "focus":
      updateFocus(student, outcome);
      break;
    default:
      break;
  }

  if (includeDaoJournal) {
    applyDaoJournal(student);
    addLogEntry(
      "Added a Dao Journal insight. Reflection deepens the path.",
      student.name
    );
  }

  updateHomeworkCompletionRate(student);
  applyRealmUpdate(student, previousRealmIndex);
  unlockAchievements(student);

  if (note && note.trim()) {
    addLogEntry(`Teacher note: ${note.trim()}`, student.name);
  }
}

function exchangeTokens(studentId, optionId) {
  const student = getStudentById(studentId);
  const option = EXCHANGE_OPTIONS.find((item) => item.id === optionId);
  if (!student || !option) return;
  if (student.tokens < option.cost) {
    addLogEntry(`Needs more Achievement Tokens for ${option.name}.`, student.name);
    return;
  }
  student.tokens -= option.cost;
  option.apply(student);
  applyRealmUpdate(student, student.realmIndex);
  addLogEntry(`Exchanged tokens for ${option.name}.`, student.name);
  render();
}

function renderStudentOptions() {
  elements.studentSelect.innerHTML = state.students
    .map((student) => `<option value="${student.id}">${student.name}</option>`)
    .join("");
}

function renderOutcomeOptions() {
  const type = elements.recordType.value;
  const options = OUTCOME_OPTIONS[type] || [];
  elements.recordOutcome.innerHTML = options
    .map((option) => `<option value="${option}">${option}</option>`)
    .join("");
}

function renderStudents() {
  elements.studentCards.innerHTML = state.students
    .map((student) => {
      const spiritPercent = (student.spirit.current / student.spirit.max) * 100;
      const powerPercent = (student.recentPower / student.recentPowerCap) * 100;
      const journalPercent = (student.daoJournal.meter / student.daoJournal.meterMax) * 100;
      const achievements = student.achievementsUnlocked.map((id) => {
        const achievement = ACHIEVEMENTS.find((item) => item.id === id);
        return achievement ? achievement.name : id;
      });

      return `
        <article class="student-card ${student.breakthrough ? "breakthrough" : ""}">
          <div class="student-header">
            <h3>${student.name}</h3>
            <span>${student.sect || "Wandering"}</span>
          </div>
          <div class="stat-grid">
            <div class="stat">
              Realm
              <strong>${REALMS[student.realmIndex]}</strong>
              <div class="bar"><div class="bar-fill" style="width:${student.realmProgress}%"></div></div>
            </div>
            <div class="stat">
              Cultivation Points
              <strong>${student.cultivationPoints}</strong>
              <div class="tag">Tokens: ${student.tokens}</div>
            </div>
            <div class="stat">
              Recent Power
              <strong>${student.recentPower}/${student.recentPowerCap}</strong>
              <div class="bar"><div class="bar-fill" style="width:${powerPercent}%"></div></div>
            </div>
            <div class="stat">
              Spirit
              <strong>${student.spirit.current}/${student.spirit.max}</strong>
              <div class="bar"><div class="bar-fill spirit" style="width:${spiritPercent}%"></div></div>
            </div>
          </div>
          <div class="stat">
            Dao Journal Insight
            <strong>${student.daoJournal.insights} entries</strong>
            <div class="bar"><div class="bar-fill journal" style="width:${journalPercent}%"></div></div>
          </div>
          <div class="tags">
            ${achievements.length ? achievements.map((name) => `<span class="tag">${name}</span>`).join("") : "<span class=\"tag\">No achievements yet</span>"}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAchievements() {
  const selectedId = elements.studentSelect.value || state.students[0].id;
  const student = getStudentById(selectedId);
  if (!student) return;

  elements.achievementList.innerHTML = ACHIEVEMENTS.map((achievement) => {
    const unlocked = student.achievementsUnlocked.includes(achievement.id);
    return `
      <div class="achievement ${unlocked ? "unlocked" : ""}">
        <strong>${achievement.name}</strong>
        <p>${achievement.description}</p>
        <p>${unlocked ? "Unlocked" : "Locked"}</p>
      </div>
    `;
  }).join("");
}

function renderExchangeOptions() {
  elements.exchangeOptions.innerHTML = EXCHANGE_OPTIONS.map((option) => {
    return `
      <div class="exchange-option">
        <div>
          <strong>${option.name}</strong>
          <p>${option.description}</p>
          <p>Cost: ${option.cost} token(s)</p>
        </div>
        <button data-exchange="${option.id}">Exchange</button>
      </div>
    `;
  }).join("");
}

function renderLogs() {
  elements.logEntries.innerHTML = state.logs
    .map((entry) => {
      return `
        <div class="log-entry">
          <time>${entry.time}</time>
          <strong>${entry.studentName}:</strong> ${entry.message}
        </div>
      `;
    })
    .join("");
}

function render() {
  renderStudentOptions();
  renderOutcomeOptions();
  renderStudents();
  renderAchievements();
  renderExchangeOptions();
  renderLogs();

  state.students.forEach((student) => {
    if (student.breakthrough) {
      setTimeout(() => {
        student.breakthrough = false;
        renderStudents();
      }, 1500);
    }
  });
}

function handleRecordSubmit(event) {
  event.preventDefault();
  const studentId = elements.studentSelect.value;
  const recordType = elements.recordType.value;
  const outcome = elements.recordOutcome.value;
  const note = elements.recordNote.value;
  const includeDaoJournal = elements.daoJournal.checked;

  applyRecord(studentId, recordType, outcome, note, includeDaoJournal);
  elements.recordNote.value = "";
  elements.daoJournal.checked = false;
  render();
}

function handleRecordTypeChange() {
  renderOutcomeOptions();
}

function handleExchange(event) {
  const optionId = event.target.dataset.exchange;
  if (!optionId) return;
  const studentId = elements.studentSelect.value;
  exchangeTokens(studentId, optionId);
}

function saveState() {
  localStorage.setItem("cultivationState", JSON.stringify(state));
  addLogEntry("State saved to local storage.", "System");
  renderLogs();
}

function loadState() {
  const saved = localStorage.getItem("cultivationState");
  if (!saved) {
    addLogEntry("No saved state found.", "System");
    renderLogs();
    return;
  }
  state = JSON.parse(saved);
  normalizeState(state);
  addLogEntry("State loaded from local storage.", "System");
  render();
}

function resetState() {
  state = deepCopy(initialState);
  normalizeState(state);
  addLogEntry("State reset to initial setup.", "System");
  render();
}

function init() {
  normalizeState(state);
  render();
  elements.recordForm.addEventListener("submit", handleRecordSubmit);
  elements.recordType.addEventListener("change", handleRecordTypeChange);
  elements.studentSelect.addEventListener("change", renderAchievements);
  elements.exchangeOptions.addEventListener("click", handleExchange);
  elements.saveBtn.addEventListener("click", saveState);
  elements.loadBtn.addEventListener("click", loadState);
  elements.resetBtn.addEventListener("click", resetState);
}

init();
