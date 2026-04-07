(function () {
  const DEFAULT_TARGET = 10;
  const AUTO_ADVANCE_MS = 700;
  const IS_MOBILE_APP = document.body && document.body.dataset.app === "mobile";
  const HAS_MAIN_MENU = Boolean(document.getElementById("mainMenuOverlay"));

  const state = {
    mode: "graph",
    currentQuestion: null,
    answered: 0,
    correct: 0,
    dragSelection: null,
    leaderboardMode: null,
    showNamePrompt: false,
    mainMenuOpen: HAS_MAIN_MENU,
    challenge: {
      active: false,
      mode: null,
      sessionId: "",
      playerName: "",
      startedAtMs: 0,
      correctTarget: DEFAULT_TARGET,
      correctCount: 0,
      wrongCount: 0,
      timerId: null,
      finishing: false
    }
  };

  const els = {
    modeButtons: Array.from(document.querySelectorAll(".mode-button[data-mode]")),
    challengeButtons: Array.from(document.querySelectorAll(".mode-button[data-challenge-mode]")),
    leaderboardButtons: Array.from(document.querySelectorAll(".mode-button[data-leaderboard-mode]")),
    practiceModeButton: document.getElementById("practiceModeButton"),
    speedChallengeButton: document.getElementById("speedChallengeButton"),
    leaderboardButton: document.getElementById("leaderboardButton"),
    questionTitle: document.getElementById("questionTitle"),
    questionPrompt: document.getElementById("questionPrompt"),
    questionBody: document.getElementById("questionBody"),
    challengeBanner: document.getElementById("challengeBanner"),
    nextButton: document.getElementById("nextButton"),
    feedbackCard: document.getElementById("feedbackCard"),
    feedbackStatus: document.getElementById("feedbackStatus"),
    feedbackText: document.getElementById("feedbackText"),
    answeredCount: document.getElementById("answeredCount"),
    correctCount: document.getElementById("correctCount"),
    accuracyRate: document.getElementById("accuracyRate"),
    playerNameInput: document.getElementById("playerNameInput"),
    challengeStatus: document.getElementById("challengeStatus"),
    mainMenuOverlay: document.getElementById("mainMenuOverlay"),
    mainMenuPracticeButton: document.getElementById("mainMenuPracticeButton"),
    mainMenuChallengeButton: document.getElementById("mainMenuChallengeButton"),
    mainMenuLeaderboardButton: document.getElementById("mainMenuLeaderboardButton"),
    practiceControls: document.getElementById("practiceControls"),
    challengeControls: document.getElementById("challengeControls"),
    leaderboardControls: document.getElementById("leaderboardControls"),
    exitPracticeButton: document.getElementById("exitPracticeButton"),
    quitChallengeButton: document.getElementById("quitChallengeButton"),
    mainMenuButton: document.getElementById("mainMenuButton"),
    challengeTopbar: document.getElementById("challengeTopbar"),
    challengeAnswered: document.getElementById("challengeAnswered"),
    challengeCorrect: document.getElementById("challengeCorrect"),
    challengeTimer: document.getElementById("challengeTimer")
  };

  const server = {
    get endpoint() {
      return (window.CHALLENGE_CONFIG && window.CHALLENGE_CONFIG.endpoint || "").trim();
    },

    available() {
      return this.endpoint.length > 0;
    },

    request(params) {
      return new Promise((resolve, reject) => {
        if (!this.available()) {
          reject(new Error("Add your Google Apps Script web app URL to window.CHALLENGE_CONFIG.endpoint in index.html."));
          return;
        }

        const callbackName = `codexChallengeCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
        const script = document.createElement("script");
        const cleanup = () => {
          delete window[callbackName];
          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }
          clearTimeout(timeoutId);
        };

        const timeoutId = window.setTimeout(() => {
          cleanup();
          reject(new Error("The challenge server took too long to respond."));
        }, 12000);

        window[callbackName] = (payload) => {
          cleanup();
          resolve(payload);
        };

        const query = new URLSearchParams({ ...params, callback: callbackName });
        script.src = `${this.endpoint}${this.endpoint.includes("?") ? "&" : "?"}${query.toString()}`;
        script.async = true;
        script.onerror = () => {
          cleanup();
          reject(new Error("Could not reach the challenge server."));
        };
        document.body.appendChild(script);
      });
    },

    startChallenge(mode, name) {
      return this.request({ action: "startChallenge", mode, name });
    },

    finishChallenge(payload) {
      return this.request({ action: "finishChallenge", ...payload });
    },

    getLeaderboard(mode) {
      return this.request({ action: "getLeaderboard", mode });
    }
  };

  const modeMeta = {
    scenario: { label: "Demand Basics", title: "Review the law of demand and demand shifters." },
    table: { label: "Demand Schedules", title: "Practice reading and comparing demand schedules." },
    graph: { label: "Demand Graphs", title: "Read demand curves and identify movement or shifts." },
    mixed: { label: "Demand Review", title: "Mix together schedules and graphs." }
  };

  const demandGoods = [
    "pizza slices",
    "campus coffee drinks",
    "movie tickets",
    "hoodies",
    "concert tickets",
    "bottled water"
  ];

  const graphAnswerChoices = [
    "Movement from line A to line B",
    "Movement from line B to line A",
    "Movement from point x to point y",
    "Movement from point y to point x"
  ];

  const conceptQuestions = [
    {
      prompt: "Which would represent an increase in demand?",
      outcome: "increase in demand",
      explanation: "An increase in demand shifts the whole demand curve to the right, so it is shown by moving from line A to line B."
    },
    {
      prompt: "Which would represent a decrease in demand?",
      outcome: "decrease in demand",
      explanation: "A decrease in demand shifts the whole demand curve to the left, so it is shown by moving from line B to line A."
    },
    {
      prompt: "Which would represent an increase in quantity demanded?",
      outcome: "increase in quantity demanded",
      explanation: "An increase in quantity demanded is movement down and to the right along the same demand curve, from point x to point y."
    },
    {
      prompt: "Which would represent a decrease in quantity demanded?",
      outcome: "decrease in quantity demanded",
      explanation: "A decrease in quantity demanded is movement up and to the left along the same demand curve, from point y to point x."
    }
  ];

  const substitutePairs = [
    ["Coke", "Pepsi"],
    ["butter", "margarine"],
    ["tea", "coffee"],
    ["chicken sandwiches", "hamburgers"]
  ];

  const complementPairs = [
    ["hot dogs", "hot dog buns"],
    ["printers", "ink cartridges"],
    ["coffee", "cream"],
    ["smartphones", "phone cases"]
  ];

  const normalGoods = [
    "restaurant meals",
    "concert tickets",
    "new sneakers",
    "vacations"
  ];

  const inferiorGoods = [
    "ramen noodles",
    "store-brand groceries",
    "used textbooks",
    "bus rides"
  ];

  const ownPriceMovementGoods = [
    "hot dogs",
    "bus rides",
    "concert tickets",
    "bottled water",
    "pizza slices",
    "movie tickets"
  ];

  const tastePreferenceGoods = [
    {
      good: "a brand of sunglasses",
      increaseEvent: "A celebrity is seen wearing a brand of sunglasses, and suddenly many more people want them.",
      decreaseEvent: "A brand of sunglasses suddenly goes out of style and far fewer people want to wear it."
    },
    {
      good: "a style of clothing",
      increaseEvent: "A style of clothing suddenly becomes fashionable.",
      decreaseEvent: "A style of clothing becomes unfashionable."
    },
    {
      good: "blueberries",
      increaseEvent: "A popular health report says eating more blueberries is good for you.",
      decreaseEvent: "A scare story makes people much less interested in buying blueberries."
    },
    {
      good: "a restaurant's meals",
      increaseEvent: "A restaurant gets rave reviews and suddenly seems much more appealing.",
      decreaseEvent: "A wave of bad reviews makes a restaurant much less appealing."
    }
  ];

  const futurePriceGoods = [
    "Apple Watches",
    "used cars",
    "concert tickets",
    "gaming consoles"
  ];

  const futureIncomeGoods = {
    normal: ["restaurant meals", "vacations", "new laptops", "movie tickets"],
    inferior: ["ramen noodles", "bus rides", "store-brand groceries", "used textbooks"]
  };

  const networkGoods = [
    "iMessage",
    "a credit card",
    "a social media app",
    "a ride-sharing platform"
  ];

  const congestionScenarios = [
    {
      person: "Jay",
      moreCrowdedEvent: "Jay finds out that a fancy restaurant will be very busy on Valentine's Day.",
      lessCrowdedEvent: "Jay finds out that a fancy restaurant will be much less busy on Valentine's Day than usual.",
      good: "this restaurant"
    },
    {
      person: "Mia",
      moreCrowdedEvent: "Mia finds out that a popular beach will be very crowded this weekend.",
      lessCrowdedEvent: "Mia finds out that a popular beach will be much less crowded this weekend.",
      good: "this beach"
    },
    {
      person: "Leo",
      moreCrowdedEvent: "Leo finds out that a hiking trail will be packed with hikers this Saturday.",
      lessCrowdedEvent: "Leo finds out that a hiking trail will be much less crowded this Saturday.",
      good: "this hiking trail"
    },
    {
      person: "Ava",
      moreCrowdedEvent: "Ava finds out that a highway route will be extremely congested during rush hour tomorrow.",
      lessCrowdedEvent: "Ava finds out that a highway route will be much less congested during rush hour tomorrow.",
      good: "this route"
    }
  ];

  const numberOfBuyersScenarios = [
    {
      location: "Spartanville",
      good: "restaurants in Spartanville",
      increaseEvent: "There is an increase in the population of Spartanville.",
      decreaseEvent: "There is a decrease in the population of Spartanville."
    },
    {
      location: "a college town",
      good: "apartments in the college town",
      increaseEvent: "A college town gains thousands of new students.",
      decreaseEvent: "A college town loses thousands of students."
    },
    {
      location: "a growing suburb",
      good: "grocery stores in the suburb",
      increaseEvent: "A growing suburb gets many new households.",
      decreaseEvent: "A suburb loses many households as people move away."
    },
    {
      location: "a beach town",
      good: "hotel rooms in the beach town",
      increaseEvent: "A beach town expects many more tourists this summer.",
      decreaseEvent: "A beach town expects far fewer tourists this summer."
    }
  ];

  const graphQuestionWeights = [
    { weight: 0.15, create: generateConceptGraphQuestion },
    { weight: 0.07, create: generateOwnPriceMovementGraphQuestion },
    { weight: 0.10, create: () => generateRelatedGoodsGraphQuestion("substitutes") },
    { weight: 0.10, create: () => generateRelatedGoodsGraphQuestion("complements") },
    { weight: 0.075, create: () => generateIncomeGraphQuestion("normal") },
    { weight: 0.075, create: () => generateIncomeGraphQuestion("inferior") },
    { weight: 0.10, create: generateTastePreferenceGraphQuestion },
    { weight: 0.07, create: generateExpectedPriceGraphQuestion },
    { weight: 0.07, create: generateExpectedIncomeGraphQuestion },
    { weight: 0.07, create: generateNetworkGraphQuestion },
    { weight: 0.07, create: generateCongestionGraphQuestion },
    { weight: 0.05, create: generateNumberOfBuyersGraphQuestion }
  ];

  const scenarioQuestions = [
    {
      title: "Choice Coach",
      prompt: "A student is deciding whether to attend an optional review session that lasts two hours. The session is free, but the student would otherwise work a shift that pays $36. What is the opportunity cost of attending the review session?",
      choices: ["Zero, because the review session is free", "$36", "Only the bus ride to campus", "The value of the whole course grade"],
      answer: 1,
      explanation: "Opportunity cost is the best alternative given up. Here, attending the review session means giving up the $36 work shift."
    },
    {
      title: "Choice Coach",
      prompt: "A student already paid $12 for a movie ticket. After 20 minutes, the movie is terrible. Which statement best fits the core principles?",
      choices: [
        "The student should stay because leaving would waste the $12",
        "The student should ignore the $12 because it is a sunk cost",
        "The student should stay unless another movie is playing",
        "The student should count the $12 twice because it was already spent"
      ],
      answer: 1,
      explanation: "The ticket money is already gone and cannot be recovered, so it is a sunk cost. The decision now should depend on the value of staying versus leaving."
    },
    {
      title: "Choice Coach",
      prompt: "A student is considering taking one more practice quiz. The extra quiz will likely raise the exam score by 2 points, but it will take an hour that the student values at more than those 2 points. What should the student do?",
      choices: [
        "Take the extra quiz because more practice is always better",
        "Skip the quiz because the marginal cost is greater than the marginal benefit",
        "Take the quiz only if a friend is also studying",
        "Skip the quiz because practice has zero benefit"
      ],
      answer: 1,
      explanation: "The marginal principle says to do one more unit only when the extra benefit is at least as large as the extra cost."
    },
    {
      title: "Choice Coach",
      prompt: "A student wins a free ticket to two events happening at the same time. The student chooses the basketball game. The next-best option was a concert. What is the opportunity cost of going to the basketball game?",
      choices: ["Zero, because the ticket was free", "The concert", "The basketball game", "Both events together"],
      answer: 1,
      explanation: "Even when an option is free, it still has an opportunity cost if the student gives up a valuable alternative."
    },
    {
      title: "Choice Coach",
      prompt: "A student has already spent four hours studying and is deciding whether to study a fifth hour. The fifth hour would add a little benefit, but the student is exhausted and the extra hour feels very costly. Which principle best helps with this choice?",
      choices: ["Opportunity cost only", "Marginal principle", "Sunk cost principle", "Only the total benefit principle"],
      answer: 1,
      explanation: "This is a one-more-unit question, so the marginal principle is the right guide."
    },
    {
      title: "Choice Coach",
      prompt: "A student says, \"I should keep reading this chapter because I already spent three hours on it.\" What is the best response?",
      choices: [
        "That is correct because past study time raises future benefits",
        "That is correct because time spent is always an opportunity cost in the future",
        "That mixes in sunk cost thinking; the next choice should depend on the benefits and costs of one more hour",
        "That means the student should stop immediately"
      ],
      answer: 2,
      explanation: "Past time is already gone. The current decision should depend on the next hour, not on hours that cannot be recovered."
    }
  ];

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function sample(arr) {
    return arr[randInt(0, arr.length - 1)];
  }

  function sampleWeighted(items) {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let draw = Math.random() * totalWeight;
    for (const item of items) {
      draw -= item.weight;
      if (draw <= 0) {
        return item;
      }
    }
    return items[items.length - 1];
  }

  function formatMoney(n) {
    return "$" + Number(n).toFixed(0);
  }

  function cumulative(values) {
    let total = 0;
    return values.map((value) => {
      total += value;
      return total;
    });
  }

  function computeAccuracy() {
    return state.answered ? Math.round((state.correct / state.answered) * 100) : 0;
  }

  function updateStats() {
    if (els.answeredCount) {
      els.answeredCount.textContent = String(state.answered);
    }
    if (els.correctCount) {
      els.correctCount.textContent = String(state.correct);
    }
    if (els.accuracyRate) {
      els.accuracyRate.textContent = `${computeAccuracy()}%`;
    }
    updateMobileTopbar();
  }

  function updateMobileTopbar() {
    if (!IS_MOBILE_APP || !els.challengeTopbar) {
      return;
    }

    const challengeActive = state.challenge.active;
    els.challengeTopbar.classList.toggle("hidden", !challengeActive);
    if (!challengeActive) {
      return;
    }

    if (els.challengeAnswered) {
      els.challengeAnswered.textContent = String(state.challenge.correctCount + state.challenge.wrongCount);
    }
    if (els.challengeCorrect) {
      els.challengeCorrect.textContent = String(state.challenge.correctCount);
    }
    if (els.challengeTimer) {
      els.challengeTimer.textContent = formatElapsed(localChallengeElapsedSeconds());
    }
  }

  function labelForMode(mode) {
    return "Graphs";
  }

  function outcomeToAnswerChoice(outcome) {
    if (outcome === "increase in demand") return graphAnswerChoices[0];
    if (outcome === "decrease in demand") return graphAnswerChoices[1];
    if (outcome === "increase in quantity demanded") return graphAnswerChoices[2];
    return graphAnswerChoices[3];
  }

  function articleFor(word) {
    return /^[aeiou]/i.test(word) ? "an" : "a";
  }

  function capitalizeFirst(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }

  function buildReferenceGraphQuestion(prompt, note, outcome, explanation) {
    return {
      type: "graph",
      title: "Demand Graphs",
      prompt,
      note,
      prices: [12, 9, 6],
      maxQuantity: 12,
      curves: [
        { label: "A", color: "#f4f6ee", quantities: [1.9, 4.6, 7.3], showPoints: false, strokeWidth: 3.2 },
        { label: "B", color: "#f4f6ee", quantities: [4.5, 7.3, 10.1], showPoints: false, strokeWidth: 3.2 }
      ],
      pointMarkers: [
        { label: "x", quantity: 4.5, price: 12, color: "#78a9ff" },
        { label: "y", quantity: 7.3, price: 9, color: "#78a9ff" }
      ],
      textAnnotations: [
        { text: "A", quantity: 7.7, price: 6.1, dx: 12, dy: 12 },
        { text: "B", quantity: 10.1, price: 7.2, dx: 18, dy: 18 },
        { text: "x", quantity: 4.5, price: 12, dx: 16, dy: -10 },
        { text: "y", quantity: 7.3, price: 9, dx: 16, dy: -12 }
      ],
      options: graphAnswerChoices.slice(),
      answer: outcomeToAnswerChoice(outcome),
      explanation,
      subtype: "choice",
      axisLabels: { x: "Q", y: "P" },
      showGrid: false,
      showTickLabels: false,
      graded: false
    };
  }

  function generateConceptGraphQuestion() {
    const question = sample(conceptQuestions);
    return buildReferenceGraphQuestion(
      question.prompt,
      "",
      question.outcome,
      question.explanation
    );
  }

  function generateRelatedGoodsGraphQuestion(relation) {
    const pair = sample(relation === "substitutes" ? substitutePairs : complementPairs);
    const priceChange = sample(["increase", "decrease"]);
    const targetIndex = randInt(0, 1);
    const targetGood = pair[targetIndex];
    const relatedGood = pair[1 - targetIndex];
    const ownPriceQuestion = Math.random() < 0.5;

    if (ownPriceQuestion) {
      const outcome = priceChange === "increase"
        ? "decrease in quantity demanded"
        : "increase in quantity demanded";
      const explanation = priceChange === "increase"
        ? `Because this is the price of ${targetGood} changing, it causes movement along the same demand curve rather than a shift in demand. The higher price reduces quantity demanded, so the answer is movement from point y to point x.`
        : `Because this is the price of ${targetGood} changing, it causes movement along the same demand curve rather than a shift in demand. The lower price increases quantity demanded, so the answer is movement from point x to point y.`;

      return buildReferenceGraphQuestion(
        `${capitalizeFirst(pair[0])} and ${pair[1]} are ${relation}. What effect would ${articleFor(priceChange)} ${priceChange} in the price of ${targetGood} have on the demand for ${targetGood}?`,
        "",
        outcome,
        explanation
      );
    }

    const demandIncreases = relation === "substitutes"
      ? priceChange === "increase"
      : priceChange === "decrease";
    const outcome = demandIncreases ? "increase in demand" : "decrease in demand";
    const explanation = relation === "substitutes"
      ? demandIncreases
        ? `Because ${pair[0]} and ${pair[1]} are substitutes, a higher price for ${relatedGood} makes buyers switch toward ${targetGood}. That increases demand, so the answer is movement from line A to line B.`
        : `Because ${pair[0]} and ${pair[1]} are substitutes, a lower price for ${relatedGood} pulls buyers away from ${targetGood}. That decreases demand, so the answer is movement from line B to line A.`
      : demandIncreases
        ? `Because ${pair[0]} and ${pair[1]} are complements, a lower price for ${relatedGood} makes consumers want more of both goods. That increases demand for ${targetGood}, so the answer is movement from line A to line B.`
        : `Because ${pair[0]} and ${pair[1]} are complements, a higher price for ${relatedGood} reduces demand for both goods. That decreases demand for ${targetGood}, so the answer is movement from line B to line A.`;

    return buildReferenceGraphQuestion(
      `${capitalizeFirst(pair[0])} and ${pair[1]} are ${relation}. What effect would ${articleFor(priceChange)} ${priceChange} in the price of ${relatedGood} have on the demand for ${targetGood}?`,
      "",
      outcome,
      explanation
    );
  }

  function generateOwnPriceMovementGraphQuestion() {
    const good = sample(ownPriceMovementGoods);
    const priceChange = sample(["increase", "decrease"]);
    const outcome = priceChange === "increase"
      ? "decrease in quantity demanded"
      : "increase in quantity demanded";
    const explanation = priceChange === "increase"
      ? `When the price of ${good} rises, that causes movement along the same demand curve rather than a shift in demand. Quantity demanded falls, so the answer is movement from point y to point x.`
      : `When the price of ${good} falls, that causes movement along the same demand curve rather than a shift in demand. Quantity demanded rises, so the answer is movement from point x to point y.`;

    return buildReferenceGraphQuestion(
      `The price of ${good} ${priceChange === "increase" ? "increases" : "decreases"}. What happens on the demand graph for ${good}?`,
      "",
      outcome,
      explanation
    );
  }

  function generateIncomeGraphQuestion(goodType) {
    const good = sample(goodType === "normal" ? normalGoods : inferiorGoods);
    const incomeChange = sample(["increase", "decrease"]);
    const demandIncreases = goodType === "normal"
      ? incomeChange === "increase"
      : incomeChange === "decrease";
    const outcome = demandIncreases ? "increase in demand" : "decrease in demand";
    const prompt = `${capitalizeFirst(good)} are ${goodType} goods. What effect would ${articleFor(incomeChange)} ${incomeChange} in income have on the demand for ${good}?`;
    const explanation = goodType === "normal"
      ? demandIncreases
        ? `${capitalizeFirst(good)} are normal goods, so higher income increases demand. That is shown by movement from line A to line B.`
        : `${capitalizeFirst(good)} are normal goods, so lower income decreases demand. That is shown by movement from line B to line A.`
      : demandIncreases
        ? `${capitalizeFirst(good)} are inferior goods, so lower income increases demand. That is shown by movement from line A to line B.`
        : `${capitalizeFirst(good)} are inferior goods, so higher income decreases demand. That is shown by movement from line B to line A.`;

    return buildReferenceGraphQuestion(
      prompt,
      "",
      outcome,
      explanation
    );
  }

  function generateTastePreferenceGraphQuestion() {
    const scenario = sample(tastePreferenceGoods);
    const preferenceChange = sample(["increase", "decrease"]);
    const outcome = preferenceChange === "increase" ? "increase in demand" : "decrease in demand";
    const prompt = `${preferenceChange === "increase" ? scenario.increaseEvent : scenario.decreaseEvent} What happens to demand for ${scenario.good}?`;
    const explanation = preferenceChange === "increase"
      ? "When tastes or preferences shift in favor of a good, demand increases. That is shown by movement from line A to line B."
      : "When tastes or preferences shift against a good, demand decreases. That is shown by movement from line B to line A.";
    return buildReferenceGraphQuestion(
      prompt,
      "",
      outcome,
      explanation
    );
  }

  function generateExpectedPriceGraphQuestion() {
    const good = sample(futurePriceGoods);
    const priceChange = sample(["increase", "decrease"]);
    const outcome = priceChange === "increase" ? "increase in demand" : "decrease in demand";
    const explanation = priceChange === "increase"
      ? `If people expect the price of ${good} to rise soon, buying later becomes less attractive and more people want to buy now. That increases demand today, so the answer is movement from line A to line B.`
      : `If people expect the price of ${good} to fall soon, buying later becomes more attractive and fewer people want to buy now. That decreases demand today, so the answer is movement from line B to line A.`;

    return buildReferenceGraphQuestion(
      `Consumers expect the price of ${good} to ${priceChange} in the near future. What happens to demand for ${good} today?`,
      "",
      outcome,
      explanation
    );
  }

  function generateExpectedIncomeGraphQuestion() {
    const goodType = sample(["normal", "inferior"]);
    const good = sample(futureIncomeGoods[goodType]);
    const incomeChange = sample(["increase", "decrease"]);
    const demandIncreases = goodType === "normal"
      ? incomeChange === "increase"
      : incomeChange === "decrease";
    const outcome = demandIncreases ? "increase in demand" : "decrease in demand";
    const explanation = goodType === "normal"
      ? demandIncreases
        ? `If consumers expect higher future income, they are more willing to buy normal goods today. That increases demand, so the answer is movement from line A to line B.`
        : `If consumers expect lower future income, they become less willing to buy normal goods today. That decreases demand, so the answer is movement from line B to line A.`
      : demandIncreases
        ? `If consumers expect lower future income, inferior goods become more attractive today. That increases demand, so the answer is movement from line A to line B.`
        : `If consumers expect higher future income, inferior goods become less attractive today. That decreases demand, so the answer is movement from line B to line A.`;

    return buildReferenceGraphQuestion(
      `Consumers expect their income to ${incomeChange} in the future. ${capitalizeFirst(good)} are ${goodType} goods. What happens to demand for ${good} today?`,
      "",
      outcome,
      explanation
    );
  }

  function generateNetworkGraphQuestion() {
    const good = sample(networkGoods);
    const usageChange = sample(["increase", "decrease"]);
    const outcome = usageChange === "increase" ? "increase in demand" : "decrease in demand";
    const explanation = usageChange === "increase"
      ? `This is a network good, so when more other people use ${good}, it becomes more valuable and demand increases. That is movement from line A to line B.`
      : `This is a network good, so when fewer other people use ${good}, it becomes less valuable and demand decreases. That is movement from line B to line A.`;

    return buildReferenceGraphQuestion(
      `Because of network effects, other people begin to ${usageChange === "increase" ? "use" : "stop using"} ${good} in larger numbers. What happens to demand for ${good}?`,
      "",
      outcome,
      explanation
    );
  }

  function generateCongestionGraphQuestion() {
    const scenario = sample(congestionScenarios);
    const crowdingChange = sample(["more crowded", "less crowded"]);
    const outcome = crowdingChange === "more crowded" ? "decrease in demand" : "increase in demand";
    const explanation = crowdingChange === "more crowded"
      ? "This is a congestion effect: when market demand from other people makes the good more crowded or congested, it becomes less attractive to this individual, so demand decreases. That is movement from line B to line A."
      : "This is a congestion effect: when market demand from other people makes the good less crowded or congested, it becomes more attractive to this individual, so demand increases. That is movement from line A to line B.";

    return buildReferenceGraphQuestion(
      `${crowdingChange === "more crowded" ? scenario.moreCrowdedEvent : scenario.lessCrowdedEvent} How will that affect ${scenario.person}'s demand for ${scenario.good}?`,
      "",
      outcome,
      explanation
    );
  }

  function generateNumberOfBuyersGraphQuestion() {
    const scenario = sample(numberOfBuyersScenarios);
    const buyerChange = sample(["increase", "decrease"]);
    const outcome = buyerChange === "increase" ? "increase in demand" : "decrease in demand";
    const explanation = buyerChange === "increase"
      ? "When the number of buyers increases, more people want to buy at every price, so demand increases. That is movement from line A to line B."
      : "When the number of buyers decreases, fewer people want to buy at every price, so demand decreases. That is movement from line B to line A.";

    return buildReferenceGraphQuestion(
      `${buyerChange === "increase" ? scenario.increaseEvent : scenario.decreaseEvent} How will this affect the demand for ${scenario.good}?`,
      "",
      outcome,
      explanation
    );
  }

  function formatElapsed(seconds) {
    const total = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(total / 60);
    const remaining = total % 60;
    return `${minutes}:${String(remaining).padStart(2, "0")}`;
  }

  function localChallengeElapsedSeconds() {
    if (!state.challenge.startedAtMs) {
      return 0;
    }
    return (Date.now() - state.challenge.startedAtMs) / 1000;
  }

  function setChallengeStatus(message) {
    if (els.challengeStatus) {
      els.challengeStatus.textContent = message;
    }
  }

  function openMobileMainMenu() {
    state.mainMenuOpen = true;
    state.leaderboardMode = null;
    state.showNamePrompt = false;
    resetFeedback();
    updateSidebarState();
    setChallengeStatus("");
  }

  function mobileScreen() {
    if (state.mainMenuOpen) {
      return "menu";
    }
    if (state.challenge.active) {
      return "challenge";
    }
    if (state.leaderboardMode) {
      return "leaderboard";
    }
    return "practice";
  }

  function updateMobileView() {
    if (!HAS_MAIN_MENU && !IS_MOBILE_APP) {
      return;
    }

    const screen = mobileScreen();
    if (els.mainMenuOverlay) {
      els.mainMenuOverlay.classList.toggle("hidden", screen !== "menu");
    }
    if (els.practiceControls) {
      els.practiceControls.classList.toggle("hidden", screen !== "practice");
    }
    if (els.challengeControls) {
      els.challengeControls.classList.toggle("hidden", screen !== "challenge");
    }
    if (els.leaderboardControls) {
      els.leaderboardControls.classList.toggle("hidden", screen !== "leaderboard");
    }
    document.body.classList.toggle("play-active", IS_MOBILE_APP && (screen === "practice" || screen === "challenge"));
    document.body.classList.toggle("menu-open", screen === "menu");
    if (IS_MOBILE_APP && els.challengeBanner) {
      els.challengeBanner.classList.toggle("hidden", true);
      els.challengeBanner.innerHTML = "";
    }
    updateMobileTopbar();
  }

  function updateSidebarState() {
    if (els.nextButton) {
      els.nextButton.classList.toggle("hidden", state.challenge.active || Boolean(state.leaderboardMode) || state.mainMenuOpen);
    }
    if (els.quitChallengeButton && !IS_MOBILE_APP) {
      els.quitChallengeButton.classList.toggle("hidden", !state.challenge.active);
    }
    if (els.playerNameInput) {
      els.playerNameInput.classList.toggle("hidden", !state.showNamePrompt);
    }
    if (els.practiceModeButton) {
      els.practiceModeButton.classList.toggle("active", !state.challenge.active && !state.leaderboardMode);
    }
    if (els.speedChallengeButton) {
      els.speedChallengeButton.classList.toggle("active", state.challenge.active);
    }
    if (els.leaderboardButton) {
      els.leaderboardButton.classList.toggle("active", Boolean(state.leaderboardMode) && !state.challenge.active);
    }
    updateMobileView();
  }

  function updateChallengeBanner() {
    if (IS_MOBILE_APP) {
      updateMobileTopbar();
      updateSidebarState();
      return;
    }

    if (!els.challengeBanner) {
      return;
    }

    if (!state.challenge.active) {
      els.challengeBanner.classList.add("hidden");
      els.challengeBanner.innerHTML = "";
      updateSidebarState();
      return;
    }

    els.challengeBanner.classList.remove("hidden");
    els.challengeBanner.innerHTML = `
      <span class="challenge-banner-lead">Speed challenge: see how fast you can get 10 correct.</span>
      <span>${formatElapsed(localChallengeElapsedSeconds())}</span>
      <span>${state.challenge.correctCount}/${state.challenge.correctTarget} correct</span>
      <span>${state.challenge.wrongCount} wrong</span>
    `;
    updateSidebarState();
  }

  function startChallengeTimer() {
    stopChallengeTimer();
    state.challenge.timerId = window.setInterval(updateChallengeBanner, 250);
  }

  function stopChallengeTimer() {
    if (state.challenge.timerId) {
      window.clearInterval(state.challenge.timerId);
      state.challenge.timerId = null;
    }
  }

  function clearChallengeState() {
    stopChallengeTimer();
    state.challenge.active = false;
    state.challenge.finishing = false;
    state.challenge.mode = null;
    state.challenge.sessionId = "";
    state.challenge.playerName = "";
    state.challenge.startedAtMs = 0;
    state.challenge.correctCount = 0;
    state.challenge.wrongCount = 0;
    state.challenge.correctTarget = DEFAULT_TARGET;
    updateChallengeBanner();
  }

  function enterPracticeMode() {
    if (state.challenge.active) {
      setChallengeStatus("Finish the current speed challenge before returning to practice mode.");
      return;
    }
    state.leaderboardMode = null;
    state.showNamePrompt = false;
    state.mainMenuOpen = false;
    updateSidebarState();
    setChallengeStatus("");
    nextQuestion();
  }

  function setMode(mode) {
    if (state.challenge.active) {
      setChallengeStatus("Finish the current challenge before switching practice modes.");
      return;
    }

    state.mode = mode;
    state.leaderboardMode = null;
    els.modeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === mode);
    });
    nextQuestion();
  }

  function showFeedback(isCorrect, text) {
    els.feedbackCard.classList.remove("hidden", "correct", "incorrect");
    els.feedbackCard.classList.add(isCorrect ? "correct" : "incorrect");
    els.feedbackStatus.textContent = isCorrect ? "Correct" : "Not quite";
    els.feedbackText.textContent = text;
  }

  function resetFeedback() {
    els.feedbackCard.classList.add("hidden");
    els.feedbackCard.classList.remove("correct", "incorrect");
  }

  function recordResult(isCorrect, explanation) {
    if (state.currentQuestion.graded) {
      return;
    }
    state.currentQuestion.graded = true;
    state.answered += 1;
    if (isCorrect) {
      state.correct += 1;
    }
    updateStats();
    showFeedback(isCorrect, explanation);

    if (state.challenge.active) {
      if (isCorrect) {
        state.challenge.correctCount += 1;
      } else {
        state.challenge.wrongCount += 1;
      }

      updateChallengeBanner();

      if (state.challenge.correctCount >= state.challenge.correctTarget) {
        finishChallenge();
        return;
      }

      window.setTimeout(() => {
        if (state.challenge.active && !state.challenge.finishing) {
          nextQuestion();
        }
      }, AUTO_ADVANCE_MS);
    }
  }

  function generateScenarioQuestion() {
    const base = sample(scenarioQuestions);
    return { ...base, choices: base.choices.slice(), type: "scenario", graded: false };
  }

  function ordinalSuffix(value) {
    if (value === 1) return "st";
    if (value === 2) return "nd";
    if (value === 3) return "rd";
    return "th";
  }

  function buildMarginalSeries(pattern, start, length) {
    const values = [];
    if (pattern === "constant") {
      for (let i = 0; i < length; i += 1) {
        values.push(start);
      }
      return values;
    }

    const step = randInt(2, 4);
    if (pattern === "increasing") {
      let current = start;
      for (let i = 0; i < length; i += 1) {
        values.push(current);
        current += step;
      }
      return values;
    }

    let current = Math.max(start, 1 + step * (length - 1));
    for (let i = 0; i < length; i += 1) {
      values.push(current);
      current -= step;
    }
    return values;
  }

  function buildTableRows(format, quantities, totalBenefits, totalCosts, mb, mc) {
    if (format === "marginal") {
      return {
        headers: ["Quantity", "Marginal Benefit", "Marginal Cost"],
        rows: quantities.map((quantity, index) => [quantity, formatMoney(mb[index]), formatMoney(mc[index])]),
        captionPrefix: "This is a marginal-value table."
      };
    }

    return {
      headers: ["Quantity", "Total Benefit", "Total Cost"],
      rows: quantities.map((quantity, index) => [quantity, formatMoney(totalBenefits[index]), formatMoney(totalCosts[index])]),
      captionPrefix: "This is a total-value table."
    };
  }

  function findOptimalQuantity(mb, mc) {
    let optimal = 0;
    for (let i = 0; i < mb.length; i += 1) {
      if (mb[i] >= mc[i]) {
        optimal = i + 1;
      }
    }
    return optimal;
  }

  function buildDemandSchedule() {
    const product = sample(demandGoods);
    const highestPrice = sample([12, 14, 16, 18]);
    const step = sample([2, 3]);
    const prices = Array.from({ length: 4 }, (_, index) => highestPrice - step * index);
    let quantity = randInt(2, 4);
    const quantities = [];

    for (let index = 0; index < prices.length; index += 1) {
      quantities.push(quantity);
      quantity += randInt(1, 3);
    }

    return { product, prices, quantities };
  }

  function buildShiftedDemandQuantities(baseQuantities, direction) {
    const shiftSize = direction === "increase in demand" ? randInt(1, 2) : -randInt(1, 2);
    return baseQuantities.map((quantity) => Math.max(1, quantity + shiftSize));
  }

  function demandRows(schedule) {
    return schedule.prices.map((price, index) => [formatMoney(price), schedule.quantities[index]]);
  }

  function generateTableQuestion() {
    const schedule = buildDemandSchedule();
    const questionType = sample(["quantityAtPrice", "priceAtQuantity", "changeInQD", "lawOfDemand", "shift", "shiftedQuantityAtPrice"]);
    const headers = ["Price", "Quantity Demanded"];
    const rows = demandRows(schedule);

    if (questionType === "quantityAtPrice") {
      const rowIndex = randInt(0, schedule.prices.length - 1);
      return {
        type: "table",
        title: "Demand Schedules",
        prompt: `According to this demand schedule for ${schedule.product}, what quantity is demanded at a price of ${formatMoney(schedule.prices[rowIndex])}?`,
        caption: "Read the quantity demanded directly from the schedule.",
        headers,
        rows,
        answer: schedule.quantities[rowIndex],
        explanation: `At a price of ${formatMoney(schedule.prices[rowIndex])}, the schedule shows a quantity demanded of ${schedule.quantities[rowIndex]}.`,
        graded: false
      };
    }

    if (questionType === "priceAtQuantity") {
      const rowIndex = randInt(0, schedule.prices.length - 1);
      return {
        type: "table",
        title: "Demand Schedules",
        prompt: `In this demand schedule for ${schedule.product}, what price leads to a quantity demanded of ${schedule.quantities[rowIndex]}?`,
        caption: "Read the matching price from the schedule.",
        headers,
        rows,
        answer: schedule.prices[rowIndex],
        explanation: `A quantity demanded of ${schedule.quantities[rowIndex]} goes with a price of ${formatMoney(schedule.prices[rowIndex])}.`,
        graded: false
      };
    }

    if (questionType === "changeInQD") {
      const lowerIndex = randInt(1, schedule.prices.length - 1);
      const higherIndex = lowerIndex - 1;
      const quantityChange = schedule.quantities[lowerIndex] - schedule.quantities[higherIndex];
      return {
        type: "table",
        title: "Demand Schedules",
        prompt: `If the price of ${schedule.product} falls from ${formatMoney(schedule.prices[higherIndex])} to ${formatMoney(schedule.prices[lowerIndex])}, by how many units does quantity demanded change?`,
        caption: "Compare the two rows and subtract the old quantity demanded from the new one.",
        headers,
        rows,
        answer: quantityChange,
        explanation: `Quantity demanded rises from ${schedule.quantities[higherIndex]} to ${schedule.quantities[lowerIndex]}, so it changes by ${quantityChange} units.`,
        graded: false
      };
    }

    if (questionType === "lawOfDemand") {
      const lowerIndex = randInt(1, schedule.prices.length - 1);
      const higherIndex = lowerIndex - 1;
      return {
        type: "table",
        title: "Demand Schedules",
        prompt: `In this schedule, if the price of ${schedule.product} rises from ${formatMoney(schedule.prices[lowerIndex])} to ${formatMoney(schedule.prices[higherIndex])}, what happens to quantity demanded?`,
        caption: "Use the law of demand: when price rises, quantity demanded moves in the opposite direction.",
        headers,
        rows,
        choices: [
          "quantity demanded rises",
          "quantity demanded falls",
          "quantity demanded stays the same"
        ],
        answer: "quantity demanded falls",
        explanation: `When price rises from ${formatMoney(schedule.prices[lowerIndex])} to ${formatMoney(schedule.prices[higherIndex])}, quantity demanded falls from ${schedule.quantities[lowerIndex]} to ${schedule.quantities[higherIndex]}.`,
        graded: false
      };
    }

    if (questionType === "shiftedQuantityAtPrice") {
      const shiftDirection = sample(["increase in demand", "decrease in demand"]);
      const shiftedQuantities = buildShiftedDemandQuantities(schedule.quantities, shiftDirection);
      const rowIndex = randInt(0, schedule.prices.length - 1);
      return {
        type: "table",
        title: "Demand Schedules",
        prompt: `Demand for ${schedule.product} shows ${shiftDirection === "increase in demand" ? "an" : "a"} ${shiftDirection}. In the new schedule, what quantity is demanded at a price of ${formatMoney(schedule.prices[rowIndex])}?`,
        caption: "Read the New Quantity Demanded column to find the value after the shift in demand.",
        headers: ["Price", "Original Quantity Demanded", "New Quantity Demanded"],
        rows: schedule.prices.map((price, index) => [formatMoney(price), schedule.quantities[index], shiftedQuantities[index]]),
        answer: shiftedQuantities[rowIndex],
        explanation: `With ${shiftDirection}, the new schedule shows a quantity demanded of ${shiftedQuantities[rowIndex]} at ${formatMoney(schedule.prices[rowIndex])}.`,
        graded: false
      };
    }

    const shiftDirection = sample(["increase in demand", "decrease in demand"]);
    const shiftedQuantities = buildShiftedDemandQuantities(schedule.quantities, shiftDirection);
    return {
      type: "table",
      title: "Demand Schedules",
      prompt: `At every price, the new schedule changes quantity demanded for ${schedule.product}. What does this indicate?`,
      caption: "If the entire schedule shifts right, demand increases. If the entire schedule shifts left, demand decreases.",
      headers: ["Price", "Original Quantity Demanded", "New Quantity Demanded"],
      rows: schedule.prices.map((price, index) => [formatMoney(price), schedule.quantities[index], shiftedQuantities[index]]),
      choices: ["increase in demand", "decrease in demand", "no change in demand"],
      answer: shiftDirection,
      explanation: shiftDirection === "increase in demand"
        ? "At every price, the new schedule shows more quantity demanded, so demand has increased."
        : "At every price, the new schedule shows less quantity demanded, so demand has decreased.",
      graded: false
    };
  }

  function generateGraphQuestion() {
    return sampleWeighted(graphQuestionWeights).create();
  }

  function generateMixedQuestion() {
    return sample([generateScenarioQuestion, generateTableQuestion, generateGraphQuestion])();
  }

  async function startChallenge(mode) {
    if (state.challenge.active) {
      setChallengeStatus("Finish the current challenge before starting a new one.");
      return;
    }

    let playerName = (els.playerNameInput && els.playerNameInput.value || "").trim();
    if (!playerName && !IS_MOBILE_APP) {
      const enteredName = (window.prompt("Enter your name for the speed challenge:", "") || "").trim();
      if (enteredName) {
        playerName = enteredName;
        if (els.playerNameInput) {
          els.playerNameInput.value = enteredName;
        }
        persistPlayerName();
      }
    }
    if (!playerName) {
      state.showNamePrompt = true;
      state.mainMenuOpen = true;
      updateSidebarState();
      setChallengeStatus("Enter your name, then choose Speed Challenge again to start.");
      if (els.playerNameInput) {
        els.playerNameInput.focus();
      }
      return;
    }

    state.showNamePrompt = false;
    state.leaderboardMode = null;
    state.mainMenuOpen = false;
    updateSidebarState();
    setChallengeStatus(`Starting ${labelForMode(mode)} challenge...`);
    renderLoadingCard("Loading your first question...");

    try {
      const response = await server.startChallenge(mode, playerName);
      if (!response || !response.ok) {
        throw new Error(response && response.error ? response.error : "Could not start the challenge.");
      }

      state.challenge.active = true;
      state.challenge.finishing = false;
      state.challenge.mode = mode;
      state.challenge.sessionId = response.sessionId;
      state.challenge.playerName = playerName;
      state.challenge.startedAtMs = new Date(response.startedAt).getTime() || Date.now();
      state.challenge.correctTarget = Number(response.targetCorrect || DEFAULT_TARGET);
      state.challenge.correctCount = 0;
      state.challenge.wrongCount = 0;

      state.mode = mode;
      els.modeButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.mode === mode);
      });

      startChallengeTimer();
      updateChallengeBanner();
      setChallengeStatus("Speed challenge is live.");
      nextQuestion();
    } catch (error) {
      setChallengeStatus(error.message);
      renderServerSetupCard(error.message);
    }
  }

  async function finishChallenge() {
    if (!state.challenge.active || state.challenge.finishing) {
      return;
    }

    state.challenge.finishing = true;
    stopChallengeTimer();
    updateChallengeBanner();
    setChallengeStatus("Submitting challenge result...");
    renderLoadingCard("Submitting time to leaderboard...");

    try {
      const response = await server.finishChallenge({
        sessionId: state.challenge.sessionId,
        mode: state.challenge.mode,
        name: state.challenge.playerName,
        correctCount: state.challenge.correctCount,
        wrongCount: state.challenge.wrongCount
      });

      if (!response || !response.ok) {
        throw new Error(response && response.error ? response.error : "Could not finish the challenge.");
      }

      const finishedMode = state.challenge.mode;
      const officialTime = Number(response.officialTimeSeconds || 0);
      const wrongCount = state.challenge.wrongCount;
      const leaderboard = response.leaderboard || [];

      clearChallengeState();
      setChallengeStatus("");
      renderFinishCard({
        mode: finishedMode,
        officialTimeSeconds: officialTime,
        wrongCount,
        rank: response.rank,
        leaderboard
      });
    } catch (error) {
      const fallbackMode = state.challenge.mode;
      const fallbackTime = localChallengeElapsedSeconds();
      const wrongCount = state.challenge.wrongCount;

      clearChallengeState();
      setChallengeStatus("");
      renderFinishCard({
        mode: fallbackMode || "graph",
        officialTimeSeconds: fallbackTime,
        wrongCount,
        error: error.message,
        leaderboard: []
      });
    }
  }

  async function showLeaderboard(mode) {
    if (state.challenge.active) {
      setChallengeStatus("Finish the current challenge before opening the leaderboard.");
      return;
    }

    state.showNamePrompt = false;
    state.mainMenuOpen = false;
    updateSidebarState();
    setChallengeStatus("");
    els.questionPrompt.textContent = "Leaderboard";
    els.questionBody.innerHTML = `<p class="server-note">Loading leaderboard...</p>`;
    resetFeedback();

    try {
      const response = await server.getLeaderboard(mode);
      if (!response || !response.ok) {
        throw new Error(response && response.error ? response.error : "Could not load the leaderboard.");
      }
      state.leaderboardMode = mode;
      setChallengeStatus("");
      renderLeaderboardCard(mode, response.results || []);
    } catch (error) {
      setChallengeStatus(error.message);
      renderServerSetupCard(error.message);
    }
  }

  function renderServerSetupCard(message) {
    els.questionPrompt.textContent = "Challenge leaderboard setup";
    els.questionBody.innerHTML = `
      <div class="leaderboard-card">
        <h3>Connect the challenge server</h3>
        <p class="server-note">${message}</p>
        <p class="server-note">Deploy the Google Apps Script in <code>google-apps-script.gs</code> as a web app, then paste the web app URL into <code>window.CHALLENGE_CONFIG.endpoint</code> in index.html.</p>
      </div>
    `;
  }

  function renderLoadingCard(message) {
    els.questionPrompt.textContent = "Loading...";
    els.questionBody.innerHTML = `<p class="server-note">${message}</p>`;
    resetFeedback();
  }

  function renderFinishCard(result) {
    state.leaderboardMode = result.mode;
    state.mainMenuOpen = false;
    updateSidebarState();
    const leaderboardMarkup = result.leaderboard && result.leaderboard.length
      ? `
        <div class="leaderboard-list">
          ${result.leaderboard.slice(0, 10).map((entry) => `
            <div class="leaderboard-row">
              <div class="leaderboard-rank">#${entry.rank}</div>
              <div><div>${entry.name}</div>${formatLeaderboardDate(entry) ? `<div class="leaderboard-date">${formatLeaderboardDate(entry)}</div>` : ""}</div>
              <div class="leaderboard-time">${entry.timeDisplay}</div>
            </div>
          `).join("")}
        </div>
      `
      : `<p class="leaderboard-empty">No leaderboard entries yet.</p>`;

    els.questionPrompt.textContent = "Leaderboard";
    els.questionBody.innerHTML = `
      <div class="leaderboard-card">
        <p class="server-note">${(els.playerNameInput && els.playerNameInput.value.trim()) || "Player"} finished the ${labelForMode(result.mode).toLowerCase()} challenge with ${result.wrongCount} wrong answer${result.wrongCount === 1 ? "" : "s"} in ${formatElapsed(result.officialTimeSeconds)}.</p>
        ${typeof result.rank === "number" ? `<p class="server-note">Current rank: #${result.rank}</p>` : ""}
        ${result.error ? `<p class="server-note">${result.error}</p>` : ""}
        <p class="server-note">Fastest times to 10 correct.</p>
        ${leaderboardMarkup}
      </div>
    `;
  }

  function renderLeaderboardCard(mode, results) {
    state.leaderboardMode = mode;
    state.mainMenuOpen = false;
    updateSidebarState();
    const rows = results.length
      ? `
        <div class="leaderboard-list">
          ${results.slice(0, 10).map((entry) => `
            <div class="leaderboard-row">
              <div class="leaderboard-rank">#${entry.rank}</div>
              <div><div>${entry.name}</div>${formatLeaderboardDate(entry) ? `<div class="leaderboard-date">${formatLeaderboardDate(entry)}</div>` : ""}</div>
              <div class="leaderboard-time">${entry.timeDisplay}</div>
            </div>
          `).join("")}
        </div>
      `
      : `<p class="leaderboard-empty">No times have been posted yet.</p>`;

    els.questionPrompt.textContent = "Leaderboard";
    els.questionBody.innerHTML = `
      <div class="leaderboard-card">
        <p class="server-note">Fastest times to 10 correct.</p>
        ${rows}
      </div>
    `;
  }

  function nextQuestion() {
    resetFeedback();
    state.dragSelection = null;
    state.leaderboardMode = null;
    state.showNamePrompt = false;
    if (!state.challenge.active) {
      state.mainMenuOpen = false;
    }
    updateSidebarState();

    state.currentQuestion = generateGraphQuestion();

    renderQuestion();
  }

  function renderQuestion() {
    const question = state.currentQuestion;
    els.questionTitle.textContent = question.title;
    els.questionPrompt.textContent = question.prompt;
    els.questionBody.innerHTML = "";
    updateChallengeBanner();

    if (question.type === "scenario") renderScenario(question);
    if (question.type === "table") renderTable(question);
    if (question.type === "graph") renderGraph(question);
  }

  function renderScenario(question) {
    const wrapper = document.createElement("div");
    wrapper.className = "choice-grid";

    question.choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.className = "choice-button";
      button.textContent = choice;
      button.addEventListener("click", () => {
        if (question.graded) return;
        const isCorrect = index === question.answer;
        Array.from(wrapper.children).forEach((child, childIndex) => {
          if (childIndex === question.answer) child.classList.add("correct");
          if (childIndex === index && !isCorrect) child.classList.add("incorrect");
        });
        recordResult(isCorrect, question.explanation);
      });
      wrapper.appendChild(button);
    });

    els.questionBody.appendChild(wrapper);
  }

  function renderTable(question) {
    const shell = document.createElement("div");
    shell.className = "table-shell";

    const caption = document.createElement("p");
    caption.className = "table-caption";
    caption.textContent = question.caption;
    shell.appendChild(caption);

    const table = document.createElement("table");
    table.innerHTML = `<thead><tr>${question.headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>`;
    const tbody = document.createElement("tbody");

    question.rows.forEach((cells) => {
      const row = document.createElement("tr");
      row.innerHTML = cells.map((cell) => `<td>${cell}</td>`).join("");
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    shell.appendChild(table);

    if (question.choices) {
      const wrapper = document.createElement("div");
      wrapper.className = "choice-grid";
      question.choices.forEach((choice) => {
        const button = document.createElement("button");
        button.className = "choice-button";
        button.textContent = choice;
        button.addEventListener("click", () => {
          if (question.graded) return;
          const isCorrect = choice === question.answer;
          Array.from(wrapper.children).forEach((child) => {
            if (child.textContent === question.answer) child.classList.add("correct");
            if (child.textContent === choice && !isCorrect) child.classList.add("incorrect");
          });
          recordResult(isCorrect, question.explanation);
        });
        wrapper.appendChild(button);
      });
      shell.appendChild(wrapper);
    } else {
      const answerRow = document.createElement("div");
      answerRow.className = "answer-row";
      const input = document.createElement("input");
      input.className = "inline-input";
      input.type = "number";
      input.placeholder = "Answer";

      const button = document.createElement("button");
      button.className = "action-button";
      button.textContent = "Check Answer";
      button.addEventListener("click", () => {
        if (question.graded) return;
        const isCorrect = Number(input.value) === question.answer;
        input.disabled = true;
        button.disabled = true;
        recordResult(isCorrect, question.explanation);
      });

      answerRow.appendChild(input);
      answerRow.appendChild(button);
      shell.appendChild(answerRow);
    }

    els.questionBody.appendChild(shell);
  }

  function renderGraph(question) {
    const shell = document.createElement("div");
    shell.className = "graph-shell";

    const legendItems = question.legend || [];
    if (legendItems.length) {
      const legend = document.createElement("div");
      legend.className = "graph-legend";
      legend.innerHTML = legendItems.map((item) => `
        <span class="legend-chip"><span class="swatch" style="background:${item.color}"></span>${item.label}</span>
      `).join("");
      shell.appendChild(legend);
    }

    const graphFrame = document.createElement("div");
    graphFrame.className = "graph-frame";
    graphFrame.appendChild(buildGraphSvg(question));
    shell.appendChild(graphFrame);

    if (question.subtype === "drag") {
      const answer = document.createElement("div");
      answer.className = "graph-answer";
      answer.innerHTML = `<div class="marker-pill">${question.markerLabel || "Selected quantity"}: <span id="selectedQuantity">${state.dragSelection || 1}</span></div>`;

      const button = document.createElement("button");
      button.className = "action-button";
      button.textContent = "Check Answer";
      button.addEventListener("click", () => {
        if (question.graded) return;
        const guess = state.dragSelection || 1;
        button.disabled = true;
        recordResult(guess === question.answer, question.explanation);
      });
      answer.appendChild(button);
      shell.appendChild(answer);
    } else {
      const wrapper = document.createElement("div");
      wrapper.className = "choice-grid";
      (question.options || []).forEach((choice) => {
        const button = document.createElement("button");
        button.className = "choice-button";
        button.textContent = choice;
        button.addEventListener("click", () => {
          if (question.graded) return;
          const isCorrect = choice === question.answer;
          Array.from(wrapper.children).forEach((child) => {
            if (child.textContent === question.answer) child.classList.add("correct");
            if (child.textContent === choice && !isCorrect) child.classList.add("incorrect");
          });
          recordResult(isCorrect, question.explanation);
        });
        wrapper.appendChild(button);
      });
      shell.appendChild(wrapper);
    }

    els.questionBody.appendChild(shell);
  }

  function buildGraphSvg(question) {
    const width = 720;
    const height = 420;
    const padding = { top: 40, right: 28, bottom: 56, left: 72 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const maxQuantity = question.maxQuantity;
    const maxPrice = Math.max(...question.prices) + 2;
    const xScale = (quantity) => padding.left + (quantity / maxQuantity) * plotWidth;
    const yScale = (price) => padding.top + plotHeight - (price / maxPrice) * plotHeight;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    
    if (question.showGrid !== false) {
      question.prices.forEach((price) => {
        const y = yScale(price);
        svg.appendChild(svgNode("line", {
          x1: padding.left, y1: y, x2: width - padding.right, y2: y,
          stroke: "rgba(29,26,22,0.12)", "stroke-width": 1
        }));
        if (question.showTickLabels !== false) {
          svg.appendChild(svgNode("text", {
            x: padding.left - 12, y: y + 5, "text-anchor": "end", fill: "#6b6257", "font-size": "13"
          }, String(price)));
        }
      });

      for (let quantity = 0; quantity <= maxQuantity; quantity += 1) {
        const x = xScale(quantity);
        svg.appendChild(svgNode("line", {
          x1: x, y1: padding.top, x2: x, y2: height - padding.bottom,
          stroke: "rgba(29,26,22,0.08)", "stroke-width": 1
        }));
        if (quantity > 0 && question.showTickLabels !== false) {
          svg.appendChild(svgNode("text", {
            x, y: height - 24, "text-anchor": "middle", fill: "#6b6257", "font-size": "13"
          }, String(quantity)));
        }
      }
    }

    svg.appendChild(svgNode("line", {
      x1: padding.left, y1: height - padding.bottom, x2: width - padding.right, y2: height - padding.bottom,
      stroke: "#1d1a16", "stroke-width": 2
    }));
    svg.appendChild(svgNode("line", {
      x1: padding.left, y1: padding.top, x2: padding.left, y2: height - padding.bottom,
      stroke: "#1d1a16", "stroke-width": 2
    }));

    svg.appendChild(svgNode("text", {
      x: width / 2, y: height - 6, "text-anchor": "middle", fill: "#1d1a16", "font-size": "15", "font-weight": "700"
    }, (question.axisLabels && question.axisLabels.x) || "Quantity"));
    svg.appendChild(svgNode("text", {
      x: 28, y: 44, "text-anchor": "middle", fill: "#1d1a16", "font-size": "15", "font-weight": "700"
    }, (question.axisLabels && question.axisLabels.y) || "Price"));

    question.curves.forEach((curve) => {
      svg.appendChild(svgNode("path", {
        d: buildDemandPath(curve.quantities, question.prices, xScale, yScale),
        fill: "none", stroke: curve.color, "stroke-width": curve.strokeWidth || 4, "stroke-linecap": "round", "stroke-linejoin": "round"
      }));

      if (curve.showPoints !== false) {
        curve.quantities.forEach((quantity, index) => {
          svg.appendChild(svgNode("circle", {
            cx: xScale(quantity),
            cy: yScale(question.prices[index]),
            r: 5,
            fill: curve.color
          }));
        });
      }
    });

    (question.pointMarkers || []).forEach((marker) => {
      svg.appendChild(svgNode("circle", {
        cx: xScale(marker.quantity),
        cy: yScale(marker.price),
        r: marker.radius || 8,
        fill: marker.color || "#78a9ff",
        stroke: marker.stroke || "#1d1a16",
        "stroke-width": marker.strokeWidth || 1.5
      }));
    });

    (question.textAnnotations || []).forEach((annotation) => {
      svg.appendChild(svgNode("text", {
        x: xScale(annotation.quantity) + (annotation.dx || 0),
        y: yScale(annotation.price) + (annotation.dy || 0),
        "text-anchor": annotation.anchor || "start",
        fill: annotation.color || "#f4f6ee",
        "font-size": annotation.fontSize || 18,
        "font-weight": annotation.fontWeight || "400"
      }, annotation.text));
    });

    if (question.highlightPrices) {
      question.highlightPrices.forEach((highlight) => {
        const y = yScale(highlight.price);
        svg.appendChild(svgNode("line", {
          x1: padding.left, y1: y, x2: width - padding.right, y2: y,
          stroke: highlight.color, "stroke-width": 3, "stroke-dasharray": "9 7"
        }));

        const priceIndex = question.prices.indexOf(highlight.price);
        const highlightedCurves = Array.isArray(highlight.curves) && highlight.curves.length
          ? highlight.curves
          : [0];
        if (priceIndex >= 0) {
          highlightedCurves.forEach((curveIndex) => {
            const curve = question.curves[curveIndex];
            if (!curve) {
              return;
            }
            svg.appendChild(svgNode("circle", {
              cx: xScale(curve.quantities[priceIndex]),
              cy: y,
              r: 6,
              fill: highlight.color
            }));
          });
        }
      });
    }

    if (question.subtype === "drag") {
      if (state.dragSelection == null) state.dragSelection = 1;
      svg.appendChild(svgNode("line", {
        x1: padding.left, y1: yScale(question.targetPrice), x2: width - padding.right, y2: yScale(question.targetPrice),
        stroke: "#d9a214", "stroke-width": 3, "stroke-dasharray": "9 7"
      }));
      addDraggableMarker(svg, question, xScale, yScale, height, padding);
    }

    return svg;
  }

  function addDraggableMarker(svg, question, xScale, yScale, height, padding) {
    const markerLine = svgNode("line", { stroke: "#d9a214", "stroke-width": 4, "stroke-dasharray": "10 8" });
    const markerCircle = svgNode("circle", {
      r: 10, fill: "#d9a214", stroke: "#8b6600", "stroke-width": 2, style: "cursor: grab;"
    });
    svg.appendChild(markerLine);
    svg.appendChild(markerCircle);

    function updateMarker(quantity) {
      state.dragSelection = quantity;
      const x = xScale(quantity);
      const y = yScale(question.targetPrice);
      markerLine.setAttribute("x1", x);
      markerLine.setAttribute("x2", x);
      markerLine.setAttribute("y1", y);
      markerLine.setAttribute("y2", height - padding.bottom);
      markerCircle.setAttribute("cx", x);
      markerCircle.setAttribute("cy", y);
      const label = document.getElementById("selectedQuantity");
      if (label) label.textContent = String(quantity);
    }

    updateMarker(state.dragSelection || 1);

    const onMove = (event) => {
      const rect = svg.getBoundingClientRect();
      const x = event.clientX - rect.left;
      let bestQ = 1;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (let q = 1; q <= question.maxQuantity; q += 1) {
        const pixelX = (xScale(q) / 720) * rect.width;
        const distance = Math.abs(x - pixelX);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestQ = q;
        }
      }
      updateMarker(bestQ);
    };

    let dragging = false;
    markerCircle.addEventListener("pointerdown", (event) => {
      dragging = true;
      markerCircle.setPointerCapture(event.pointerId);
      markerCircle.style.cursor = "grabbing";
    });
    markerCircle.addEventListener("pointermove", (event) => {
      if (dragging) onMove(event);
    });
    markerCircle.addEventListener("pointerup", (event) => {
      dragging = false;
      markerCircle.releasePointerCapture(event.pointerId);
      markerCircle.style.cursor = "grab";
    });
    svg.addEventListener("click", onMove);
  }

  function buildDemandPath(quantities, prices, xScale, yScale) {
    return quantities.map((quantity, index) => `${index === 0 ? "M" : "L"} ${xScale(quantity)} ${yScale(prices[index])}`).join(" ");
  }

  function buildPath(values, xScale, yScale) {
    return values.map((value, index) => `${index === 0 ? "M" : "L"} ${xScale(index + 1)} ${yScale(value)}`).join(" ");
  }

  function svgNode(name, attrs, text) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    if (text) node.textContent = text;
    return node;
  }

  function formatLeaderboardDate(entry) {
    return entry.dateDisplay || entry.playedOn || entry.date || entry.timestampDisplay || entry.timestamp || "";
  }

  function restorePlayerName() {
    try {
      const stored = window.localStorage.getItem("demandPlayerName");
      if (stored && els.playerNameInput) {
        els.playerNameInput.value = stored;
      }
    } catch (_error) {
      // Ignore localStorage issues.
    }
  }

  function persistPlayerName() {
    try {
      if (els.playerNameInput) {
        window.localStorage.setItem("demandPlayerName", els.playerNameInput.value.trim());
      }
    } catch (_error) {
      // Ignore localStorage issues.
    }
  }

  els.modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });
  if (els.practiceModeButton) {
    els.practiceModeButton.addEventListener("click", enterPracticeMode);
  }
  els.challengeButtons.forEach((button) => {
    button.addEventListener("click", () => startChallenge(button.dataset.challengeMode));
  });
  els.leaderboardButtons.forEach((button) => {
    button.addEventListener("click", () => showLeaderboard(button.dataset.leaderboardMode));
  });
  if (els.playerNameInput) {
    els.playerNameInput.addEventListener("change", persistPlayerName);
    els.playerNameInput.addEventListener("blur", persistPlayerName);
  }
  els.nextButton.addEventListener("click", () => {
    if (state.challenge.active) {
      setChallengeStatus("The challenge advances automatically after each answer.");
      return;
    }
    nextQuestion();
  });
  if (els.mainMenuPracticeButton) {
    els.mainMenuPracticeButton.addEventListener("click", enterPracticeMode);
  }
  if (els.mainMenuChallengeButton) {
    els.mainMenuChallengeButton.addEventListener("click", () => startChallenge("graph"));
  }
  if (els.mainMenuLeaderboardButton) {
    els.mainMenuLeaderboardButton.addEventListener("click", () => showLeaderboard("graph"));
  }
  if (els.exitPracticeButton) {
    els.exitPracticeButton.addEventListener("click", openMobileMainMenu);
  }
  if (els.mainMenuButton) {
    els.mainMenuButton.addEventListener("click", openMobileMainMenu);
  }
  if (els.quitChallengeButton) {
    els.quitChallengeButton.addEventListener("click", () => {
      if (window.confirm("Quit the speed challenge and return to the main menu?")) {
        clearChallengeState();
        if (IS_MOBILE_APP) {
          openMobileMainMenu();
        } else {
          enterPracticeMode();
        }
      }
    });
  }

  restorePlayerName();
  updateStats();
  updateSidebarState();
  setChallengeStatus("");
  if (!HAS_MAIN_MENU) {
    nextQuestion();
  }
})();
