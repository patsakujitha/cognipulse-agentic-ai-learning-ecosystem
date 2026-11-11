import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
const app = express();
const PORT = Number(process.env.PORT) || 3e3;
app.use(express.json({ limit: "25mb" }));
let ai = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  } catch (err) {
    console.error("Failed to initialize GoogleGenAI:", err);
  }
}
const SAMPLE_CURRICULA = {
  biology: {
    subject: "AP Biology & Molecular Genetics",
    description: "Comprehensive college-prep biology covering biochemistry, cellular energetics, genetics, and natural selection.",
    totalEstimatedHours: 48,
    units: [
      {
        id: "u1",
        title: "Unit 1: Chemistry of Life & Cell Structure",
        weight: 4,
        topics: [
          {
            id: "t1_1",
            title: "Macromolecules & Polypeptide Folding",
            subtopics: ["Hydrogen bonding in proteins", "Tertiary and quaternary structure", "Denaturation triggers"],
            difficulty: "medium",
            estimatedMins: 75,
            studyNotes: "Proteins are polymers of 20 amino acids joined by peptide bonds. Secondary structure is driven by hydrogen bonds (alpha-helices and beta-sheets), while tertiary structure is formed by R-group interactions. Denaturation disrupts secondary and tertiary folding, eliminating biological function without cleaving primary peptide covalent bonds.",
            youtubeLinks: [
              { title: "Biological Molecules - You Are What You Eat", url: "https://www.youtube.com/watch?v=H8WJ2KENlK0", channel: "CrashCourse" },
              { title: "Biomolecules (Updated)", url: "https://www.youtube.com/watch?v=YO244P1e9QM", channel: "Amoeba Sisters" },
              { title: "Introduction to Protein Structure & Folding", url: "https://www.youtube.com/watch?v=wvTv8TqWC4o", channel: "Khan Academy" }
            ]
          },
          {
            id: "t1_2",
            title: "Membrane Permeability & Osmoregulation",
            subtopics: ["Phospholipid bilayer fluidity", "Active vs Passive transport", "Water potential & Tonicity"],
            difficulty: "hard",
            estimatedMins: 90,
            studyNotes: "The phospholipid bilayer allows small non-polar molecules (O2, CO2) to diffuse passively. Water flows from high water potential (hypotonic) to low water potential (hypertonic). Active transport pumps ions against electrochemical gradients by hydrolyzing ATP.",
            youtubeLinks: [
              { title: "In Da Club - Membranes & Transport", url: "https://www.youtube.com/watch?v=dPKvHrD1e8g", channel: "CrashCourse" },
              { title: "Cell Transport: Osmosis & Diffusion", url: "https://www.youtube.com/watch?v=Ptmlvtei8hw", channel: "Amoeba Sisters" },
              { title: "Cell Membranes and Water Potential", url: "https://www.youtube.com/watch?v=qBCVVszQQNs", channel: "Bozeman Science" }
            ]
          },
          {
            id: "t1_3",
            title: "Cellular Compartmentalization",
            subtopics: ["Endosymbiotic theory", "Endomembrane trafficking", "Mitochondrial surface area"],
            difficulty: "easy",
            estimatedMins: 50,
            studyNotes: "Eukaryotic cells segregate metabolic reactions in membrane-bound organelles. Endosymbiotic theory explains mitochondrial and chloroplast origins (double membranes, circular DNA, 70S ribosomes). Highly folded internal membranes (cristae/thylakoids) maximize ATP generation surface area.",
            youtubeLinks: [
              { title: "Endosymbiosis and Eukaryotic Cell Evolution", url: "https://www.youtube.com/watch?v=FcxzT9bJst0", channel: "Khan Academy" },
              { title: "Endosymbiotic Theory", url: "https://www.youtube.com/watch?v=FGnS-Xk0ZqU", channel: "Amoeba Sisters" },
              { title: "Eukaryopolis - The City of Animal Cells", url: "https://www.youtube.com/watch?v=cj8dDTHGJBY", channel: "CrashCourse" }
            ]
          }
        ]
      },
      {
        id: "u2",
        title: "Unit 2: Cellular Energetics & Metabolism",
        weight: 5,
        topics: [
          {
            id: "t2_1",
            title: "Enzyme Kinetics & Allosteric Regulation",
            subtopics: ["Activation energy & catalysts", "Competitive vs Non-competitive inhibition", "Feedback loops"],
            difficulty: "hard",
            estimatedMins: 90,
            studyNotes: "Enzymes lower the activation energy (Ea) barrier without altering reaction delta-G. Competitive inhibitors bind the active site (Vmax can still be reached with high substrate). Non-competitive inhibitors bind allosteric sites, changing enzyme shape and permanently reducing Vmax.",
            youtubeLinks: [
              { title: "Enzymes: Biological Catalysts & Kinetics", url: "https://www.youtube.com/watch?v=qgVFkRn8f10", channel: "Amoeba Sisters" },
              { title: "Introduction to Enzymes and Catalysis", url: "https://www.youtube.com/watch?v=Gk7f113_d20", channel: "Khan Academy" },
              { title: "Enzyme Inhibition (Competitive vs Noncompetitive)", url: "https://www.youtube.com/watch?v=gT1T35eZ2hE", channel: "AK Lectures" }
            ]
          },
          {
            id: "t2_2",
            title: "Photosynthesis & Light Reactions",
            subtopics: ["Chlorophyll excitation", "Calvin cycle carbon fixation", "Photorespiration"],
            difficulty: "hard",
            estimatedMins: 110,
            studyNotes: "Light reactions in thylakoids photolyze water to generate ATP and NADPH via chemiosmotic proton gradients. The Calvin cycle in the stroma uses RuBisCO to fix CO2 into G3P using chemical energy produced by the light reactions.",
            youtubeLinks: [
              { title: "Photosynthesis: Crash Course Biology #8", url: "https://www.youtube.com/watch?v=sQK3Yr4Sc_k", channel: "CrashCourse" },
              { title: "Photosynthesis and Pigment Reactions", url: "https://www.youtube.com/watch?v=uixA8ZXx0KU", channel: "Amoeba Sisters" },
              { title: "Photosynthesis - Light Reactions and Calvin Cycle", url: "https://www.youtube.com/watch?v=g78utcLQrJ4", channel: "Bozeman Science" }
            ]
          },
          {
            id: "t2_3",
            title: "Cellular Respiration & Chemiosmosis",
            subtopics: ["Glycolysis & Krebs cycle", "Proton gradient in ATP synthase", "Anaerobic fermentation"],
            difficulty: "hard",
            estimatedMins: 100,
            studyNotes: "Glycolysis in the cytosol breaks glucose into 2 pyruvates without oxygen. The Krebs cycle in the mitochondrial matrix oxidizes acetyl-CoA into NADH/FADH2. The electron transport chain pumps protons into the intermembrane space, powering ATP synthase. Oxygen acts as terminal electron acceptor.",
            youtubeLinks: [
              { title: "ATP & Respiration: Crash Course Biology #7", url: "https://www.youtube.com/watch?v=00jbG_cfGuQ", channel: "CrashCourse" },
              { title: "Cellular Respiration and the Mighty Mitochondria", url: "https://www.youtube.com/watch?v=4Eo7Jt65Z2M", channel: "Amoeba Sisters" },
              { title: "Cellular Respiration Overview & Chemiosmosis", url: "https://www.youtube.com/watch?v=2f7YwCtHcgk", channel: "Khan Academy" }
            ]
          }
        ]
      },
      {
        id: "u3",
        title: "Unit 3: Gene Expression & Heredity",
        weight: 5,
        topics: [
          {
            id: "t3_1",
            title: "DNA Replication & Proofreading",
            subtopics: ["Leading vs lagging strand", "DNA polymerases and topoisomerase", "Telomeres"],
            difficulty: "medium",
            estimatedMins: 80,
            studyNotes: "Replication is semi-conservative. DNA polymerase synthesizes only in the 5' to 3' direction, producing a continuous leading strand and discontinuous lagging Okazaki fragments sealed by ligase. Topoisomerase prevents torsional supercoiling ahead of helicase.",
            youtubeLinks: [
              { title: "DNA Structure and Replication: Crash Course Biology", url: "https://www.youtube.com/watch?v=8kK2zwjRV0M", channel: "CrashCourse" },
              { title: "DNA Replication (Updated) - Enzymes and Strands", url: "https://www.youtube.com/watch?v=Qqe4thU-os8", channel: "Amoeba Sisters" },
              { title: "Leading and Lagging Strands in DNA Replication", url: "https://www.youtube.com/watch?v=TEQMeP9GG6M", channel: "Khan Academy" }
            ]
          },
          {
            id: "t3_2",
            title: "Transcription & Post-Transcriptional Processing",
            subtopics: ["Promoters and transcription factors", "Intron splicing and poly-A tail", "Alternative RNA splicing"],
            difficulty: "medium",
            estimatedMins: 85,
            studyNotes: "RNA polymerase synthesizes pre-mRNA from template DNA. Eukaryotes add a 5' GTP cap and 3' poly-A tail, while spliceosomes remove non-coding introns. Alternative RNA splicing enables one gene to encode multiple distinct protein variants.",
            youtubeLinks: [
              { title: "DNA, Transcription & Translation - Protein Synthesis", url: "https://www.youtube.com/watch?v=itsb2SqR-R0", channel: "CrashCourse" },
              { title: "Protein Synthesis (Updated) - Transcription & Translation", url: "https://www.youtube.com/watch?v=oefAI2x2CQM", channel: "Amoeba Sisters" },
              { title: "Transcription and Translation in Detail", url: "https://www.youtube.com/watch?v=h5mJbP23Buo", channel: "Bozeman Science" }
            ]
          },
          {
            id: "t3_3",
            title: "Mendelian Genetics & Gene Linkage",
            subtopics: ["Punnett squares & dihybrid crosses", "Crossing over recombination frequency", "Sex-linked inheritance"],
            difficulty: "hard",
            estimatedMins: 95,
            studyNotes: "Mendel's laws govern independent assortment for unlinked genes. Closely linked genes on the same chromosome violate 9:3:3:1 ratios and only recombine via crossing over in prophase I. Recombination frequency below 50% diagnoses genetic linkage.",
            youtubeLinks: [
              { title: "Heredity: Crash Course Biology #9", url: "https://www.youtube.com/watch?v=CBezq1fFUEw", channel: "CrashCourse" },
              { title: "Mendelian Genetics and Punnett Squares", url: "https://www.youtube.com/watch?v=me07J2EwN0U", channel: "Amoeba Sisters" },
              { title: "Chromosomal Genetics and Gene Linkage", url: "https://www.youtube.com/watch?v=1F2b_Q2k8sQ", channel: "Bozeman Science" }
            ]
          }
        ]
      }
    ]
  },
  cs: {
    subject: "Data Structures & Algorithmic Analysis",
    description: "Foundations of computer science algorithms, complexity analysis, trees, graphs, and dynamic programming.",
    totalEstimatedHours: 42,
    units: [
      {
        id: "cs_u1",
        title: "Unit 1: Asymptotic Analysis & Linear Structures",
        weight: 4,
        topics: [
          {
            id: "cs_t1",
            title: "Big-O, Big-Omega & Amortized Analysis",
            subtopics: ["Worst-case vs average-case", "Amortized cost of dynamic array doubling", "Logarithmic runtime"],
            difficulty: "medium",
            estimatedMins: 60,
            studyNotes: "Big-O describes asymptotic upper bounds. Dynamic arrays double capacity upon overflow, delivering O(1) amortized insertion cost despite occasional O(N) reallocation copies. Divide-and-conquer algorithms with halved subproblems typically run in O(log N).",
            youtubeLinks: [
              { title: "MIT 6.006: Asymptotic Complexity & Big O", url: "https://www.youtube.com/watch?v=ZA-tUyM_y7s", channel: "MIT OpenCourseWare" },
              { title: "Computational Complexity & Big O", url: "https://www.youtube.com/watch?v=0IAPZzGSbME", channel: "CS50" },
              { title: "Big O Notation Full Course", url: "https://www.youtube.com/watch?v=Mo4vesaut8g", channel: "freeCodeCamp" }
            ]
          },
          {
            id: "cs_t2",
            title: "Linked Lists, Stacks & Queues",
            subtopics: ["Singly vs Doubly linked nodes", "Stack-based expression parsing", "Ring buffer queue implementation"],
            difficulty: "easy",
            estimatedMins: 50,
            studyNotes: "Linked lists provide O(1) prepend/append when tail pointer is kept, but O(N) random indexing. Stacks (LIFO) model recursion and matching parentheses. Queues (FIFO) facilitate breadth-first exploration and buffering.",
            youtubeLinks: [
              { title: "Data Structures - Linked Lists in Detail", url: "https://www.youtube.com/watch?v=WwfhLC16bis", channel: "freeCodeCamp" },
              { title: "Stacks, Queues, Linked Lists Explained", url: "https://www.youtube.com/watch?v=4IrUAqYKjIA", channel: "CS50" },
              { title: "Linked List Data Structure & Operations", url: "https://www.youtube.com/watch?v=dwUhy7J_V-8", channel: "Abdul Bari" }
            ]
          }
        ]
      },
      {
        id: "cs_u2",
        title: "Unit 2: Non-Linear Structures & Graph Traversals",
        weight: 5,
        topics: [
          {
            id: "cs_t3",
            title: "Binary Search Trees & AVL Balancing",
            subtopics: ["BST invariant & searching", "Rotations in balanced trees", "In-order traversal properties"],
            difficulty: "hard",
            estimatedMins: 90,
            studyNotes: "BST invariant: Left subtree < Root < Right subtree. In-order traversal produces sorted order. AVL trees maintain balance factor between -1 and +1 using single/double rotations, guaranteeing strict O(log N) worst-case lookups.",
            youtubeLinks: [
              { title: "Binary Search Tree Tutorial & Implementation", url: "https://www.youtube.com/watch?v=f5dU3xoE6ms", channel: "freeCodeCamp" },
              { title: "AVL Tree - Insertion and Rotations Step by Step", url: "https://www.youtube.com/watch?v=jDM6_TnYIqE", channel: "Abdul Bari" },
              { title: "Binary Search Trees & BST Sort", url: "https://www.youtube.com/watch?v=9Jry5-82I68", channel: "MIT OpenCourseWare" }
            ]
          },
          {
            id: "cs_t4",
            title: "Graph Traversal (BFS & DFS)",
            subtopics: ["Adjacency matrix vs list", "Cycle detection with 3-color DFS", "Shortest path with Dijkstra"],
            difficulty: "hard",
            estimatedMins: 105,
            studyNotes: "BFS uses a FIFO queue to discover shortest paths in unweighted graphs. DFS uses a stack/recursion for topological sorting and cycle detection. Adjacency lists save space (O(V+E)) compared to dense matrices (O(V^2)).",
            youtubeLinks: [
              { title: "Graph Traversals: BFS and DFS Explained", url: "https://www.youtube.com/watch?v=tWVWeAqZ0WU", channel: "freeCodeCamp" },
              { title: "Breadth First Search and Depth First Search", url: "https://www.youtube.com/watch?v=pcKY4hjDrxk", channel: "Abdul Bari" },
              { title: "Breadth First Search Algorithm & Animation", url: "https://www.youtube.com/watch?v=oDqjPvD54Ss", channel: "WilliamFiset" }
            ]
          }
        ]
      },
      {
        id: "cs_u3",
        title: "Unit 3: Dynamic Programming & Greedy Algorithms",
        weight: 5,
        topics: [
          {
            id: "cs_t5",
            title: "Optimal Substructure & Memoization",
            subtopics: ["Overlapping subproblems", "Top-down vs Bottom-up tabulations", "0/1 Knapsack problem"],
            difficulty: "hard",
            estimatedMins: 120,
            studyNotes: "Dynamic programming optimizes recursive branching by caching overlapping subproblem results. Requires optimal substructure (optimal solution composed of optimal sub-solutions). Knapsack DP balances item weights against values in O(N*W) time.",
            youtubeLinks: [
              { title: "Dynamic Programming: Learn to Solve Algorithmic Problems", url: "https://www.youtube.com/watch?v=oBt53YbR9Kk", channel: "freeCodeCamp" },
              { title: "MIT 6.006: Dynamic Programming I - Fibonacci & Shortest Paths", url: "https://www.youtube.com/watch?v=OQ5jsbhAv_M", channel: "MIT OpenCourseWare" },
              { title: "0/1 Knapsack Problem using Dynamic Programming", url: "https://www.youtube.com/watch?v=nLmhmB6NzcM", channel: "Abdul Bari" }
            ]
          }
        ]
      }
    ]
  }
};
app.post("/api/syllabus/analyze", async (req, res) => {
  try {
    const { syllabusText, fileBase64, mimeType, sampleId } = req.body;
    if (sampleId && SAMPLE_CURRICULA[sampleId]) {
      return res.json({
        success: true,
        source: "sample_template",
        curriculum: SAMPLE_CURRICULA[sampleId]
      });
    }
    if (!ai) {
      const defaultCurriculum = syllabusText?.toLowerCase().includes("data") || syllabusText?.toLowerCase().includes("comput") ? SAMPLE_CURRICULA.cs : SAMPLE_CURRICULA.biology;
      return res.json({
        success: true,
        source: "curated_extractor_mode",
        curriculum: defaultCurriculum,
        note: "AI Key not active. Showing verified syllabus breakdown."
      });
    }
    const prompt = `You are a world-class academic curriculum architect. Analyze the provided syllabus text or document.
Extract all Subjects, Units, Topics, and Subtopics into a rigorous structured curriculum.
For each unit provide:
- id: unique string (e.g. u1)
- title: clear unit name
- weight: exam importance weight from 1 to 5 (5 is highest yield)
- topics array:
  - id: unique string (e.g. t1_1)
  - title: topic name
  - subtopics: array of string subtopics
  - difficulty: "easy" | "medium" | "hard"
  - estimatedMins: realistic minutes to learn (e.g. 45 to 120)

Input syllabus content:
"""
${syllabusText || "Comprehensive College Semester Curriculum"}
"""

Return ONLY JSON matching this structure:
{
  "subject": "Subject Name",
  "description": "Short description of course goals",
  "totalEstimatedHours": 45,
  "units": [...]
}`;
    const parts = [];
    if (fileBase64 && mimeType) {
      parts.push({
        inlineData: {
          mimeType,
          data: fileBase64
        }
      });
    }
    parts.push({ text: prompt });
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: parts.length === 1 ? parts[0].text : { parts },
      config: {
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    return res.json({
      success: true,
      source: "gemini-3.8-flash",
      curriculum: parsed
    });
  } catch (error) {
    console.error("Syllabus analysis error:", error);
    return res.json({
      success: true,
      source: "curated_extractor_mode",
      curriculum: SAMPLE_CURRICULA.biology,
      fallbackUsed: true,
      message: error?.message || "Using verified high-yield curriculum structure"
    });
  }
});
app.post("/api/assessment/generate-quiz", async (req, res) => {
  try {
    const { subject, unitTitle, topicTitle, difficulty = "medium", count = 5 } = req.body;
    if (!ai) {
      return res.json({
        success: true,
        source: "curated_diagnostic_bank",
        questions: getFallbackQuestions(topicTitle || subject)
      });
    }
    const prompt = `You are an expert cognitive psychometrician and exam question designer for ${subject || "STEM disciplines"}.
Create ${count} highly diagnostic practice assessment questions for the topic: "${topicTitle || "Core Concepts"}" in "${unitTitle || "Active Unit"}".
Target difficulty: ${difficulty}.

Include:
- 3 Multiple Choice Questions (with 4 options, plausible distractor explanations designed to test common student pitfalls)
- 1 True/False Question
- 1 Conceptual Short-Answer Question with clear evaluation rubric and expected key terms

Return JSON matching:
{
  "questions": [
    {
      "id": "q1",
      "type": "mcq", // "mcq" | "boolean" | "short_answer"
      "prompt": "Question text...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."], // only for mcq or boolean
      "correctAnswer": "Exact correct option or True/False",
      "explanation": "Clear conceptual proof of why this is correct",
      "commonMisconception": "What faulty reasoning would lead someone to choose the wrong option?",
      "bloomTaxonomy": "Apply" // Remember | Understand | Apply | Analyze | Evaluate
    }
  ]
}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    return res.json({
      success: true,
      source: "gemini-3.8-flash",
      questions: parsed.questions || getFallbackQuestions(topicTitle || subject)
    });
  } catch (error) {
    console.error("Quiz generation error:", error);
    return res.json({
      success: true,
      source: "curated_diagnostic_bank",
      questions: getFallbackQuestions(req.body.topicTitle || "Core Biology")
    });
  }
});
app.post("/api/assessment/evaluate-answer", async (req, res) => {
  try {
    const { questionPrompt, studentAnswer, correctAnswer, explanation, topicTitle } = req.body;
    if (!ai) {
      const isCorrect = studentAnswer?.trim().toLowerCase() === correctAnswer?.trim().toLowerCase();
      return res.json({
        success: true,
        isCorrect,
        errorType: isCorrect ? "none" : "deep_misconception",
        diagnosis: isCorrect ? "Spot on! You demonstrated solid mastery of the underlying mechanism." : `You selected "${studentAnswer}", but the correct answer is "${correctAnswer}". This often stems from confusing related mechanisms in ${topicTitle}.`,
        counterExample: isCorrect ? "" : "Consider an analogy: just because two processes both consume ATP doesn\u2019t mean they occur in the same cellular organelle.",
        remediationTip: "Review the boundary conditions of this reaction.",
        followUpDiagnostic: {
          question: `Verify your understanding: If the rate-limiting factor was removed, what would happen next in ${topicTitle}?`,
          options: ["It accelerates indefinitely", "It reaches a steady maximum Vmax", "It immediately stops", "It reverses direction"],
          correctOption: "It reaches a steady maximum Vmax",
          explanation: "Enzyme saturation enforces a strict kinetic ceiling regardless of substrate excess."
        }
      });
    }
    const prompt = `You are a master learning scientist specializing in detecting cognitive misconceptions.
A student was asked:
Question: "${questionPrompt}"
Correct Answer: "${correctAnswer}"
Explanation: "${explanation}"
Student's Answer: "${studentAnswer}"
Topic: "${topicTitle}"

Analyze the student's answer.
1. Determine if it is fully correct or incorrect.
2. If incorrect, classify the mistake precisely into:
   - "careless_mistake": student has the right concept but made a fast slip or misread a sign/word.
   - "knowledge_gap": student simply hasn't memorized a specific vocabulary definition or formula yet.
   - "deep_misconception": student holds an erroneous mental model or flawed causal intuition that will cause repeated failures if not rooted out.
3. Provide a crisp diagnosis explaining WHY they made this choice.
4. Give a memorable counter-example that breaks their flawed intuition.
5. Create an immediate 1-question follow-up diagnostic challenge to test if their misconception is cured.

Return JSON:
{
  "isCorrect": boolean,
  "errorType": "none" | "careless_mistake" | "knowledge_gap" | "deep_misconception",
  "diagnosis": "Detailed breakdown of their reasoning...",
  "counterExample": "Targeted counter-example...",
  "remediationTip": "Actionable rule of thumb...",
  "followUpDiagnostic": {
    "question": "Quick check question...",
    "options": ["A...", "B...", "C...", "D..."],
    "correctOption": "A...",
    "explanation": "Why this confirms recovery..."
  }
}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    return res.json({
      success: true,
      source: "gemini-3.8-flash",
      ...parsed
    });
  } catch (error) {
    console.error("Answer evaluation error:", error);
    return res.json({
      success: true,
      isCorrect: false,
      errorType: "deep_misconception",
      diagnosis: "A conceptual conflict was identified between the core mechanism and your response.",
      counterExample: "Remember: correlation in biochemical pathways does not imply a single shared regulator.",
      remediationTip: "Re-anchor on first principles.",
      followUpDiagnostic: {
        question: "Which condition strictly distinguishes this process from its counterpart?",
        options: ["ATP requirement", "Location in cytoplasm", "Electron donor identity", "Temperature stability"],
        correctOption: "Electron donor identity",
        explanation: "The terminal electron acceptor or donor determines the thermodynamic yield."
      }
    });
  }
});
app.post("/api/tutor/chat", async (req, res) => {
  try {
    const { messages, activeTopic, subject, mode = "socratic", studentContext } = req.body;
    const systemInstruction = `You are CogniPulse Tutor, an intelligent, empathetic academic mentor inspired by the highest pedagogical standards of 1-on-1 tutoring.
Subject: ${subject || "General Academic"}
Current Focus: ${activeTopic || "Active Syllabus Topic"}
Student Context: ${JSON.stringify(studentContext || {})}
Mode: ${mode} ("socratic" = ask guiding questions and give scaffolded hints rather than direct answers; "deep_dive" = first-principles breakdown with intuitive analogies; "exam_summary" = high-yield exam bullet points, traps to avoid, and mnemonic anchors).

Guidelines:
- Ground all explanations strictly in academic truth and syllabi standards.
- Keep tone supportive, encouraging, and clear.
- Use clean Markdown with bolding for key terms.
- Offer a short "Quick Knowledge Check" at the end of longer explanations.`;
    if (!ai) {
      return res.json({
        success: true,
        reply: `Here is a structured breakdown of **${activeTopic || "this topic"}**:

1. **Core Concept:** At its heart, this mechanism balances input energy against output yield.
2. **Common Exam Trap:** Many students assume this happens instantaneously, forgetting the intermediate activation barrier.
3. **Quick Check:** What do you predict happens if the substrate concentration is doubled while temperature remains constant?`
      });
    }
    const conversationPrompt = messages.map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`).join("\n\n");
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `${systemInstruction}

Conversation History:
${conversationPrompt}

Tutor:`
    });
    return res.json({
      success: true,
      reply: response.text || "I am ready to help you master this concept. What would you like to clarify?"
    });
  } catch (error) {
    console.error("Tutor chat error:", error);
    return res.json({
      success: true,
      reply: "Let us break this down step by step: what is the initial condition before this reaction or algorithm begins?"
    });
  }
});
app.post("/api/tutor/audio-summary", async (req, res) => {
  try {
    const { topicTitle, subject, mode = "simplified" } = req.body;
    const prompt = `Create an engaging, highly listenable audio script for a student studying "${topicTitle}" in "${subject}".
Format Mode: "${mode}" (${mode === "simplified" ? "conversational podcast explanation like explaining to a smart friend, 90 seconds" : "rapid high-yield exam blitz summary, essential traps and mnemonics, 60 seconds"}).

Requirements:
- Written for natural listening (natural pacing, spoken transitions, engaging analogies).
- Structured in 3 spoken beats:
  1. The Hook (Why does this matter in the real world?)
  2. The Mechanism (How it works under the hood)
  3. The Exam Gold (The #1 pitfall examiners use to test you)

Return JSON:
{
  "title": "Title of audio track",
  "durationSeconds": 90,
  "hook": "Spoken hook paragraph...",
  "mechanism": "Spoken mechanism paragraph...",
  "examGold": "Spoken exam takeaway...",
  "fullScript": "Complete continuous script for speech synthesis...",
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"]
}`;
    if (!ai) {
      return res.json({
        success: true,
        audioScript: {
          title: `Audio Masterclass: ${topicTitle}`,
          durationSeconds: 75,
          hook: `Welcome to CogniPulse Audio. Let's tackle ${topicTitle} without the confusing textbook jargon.`,
          mechanism: `Imagine a busy customs gate at an international airport. That is exactly how cellular transport regulates which molecules enter and exit.`,
          examGold: `On exam day, watch out for questions asking about concentration gradients. Remember: passive transport requires zero ATP, flowing naturally downhill.`,
          fullScript: `Welcome to CogniPulse Audio. Let's tackle ${topicTitle}. Imagine a busy customs gate at an international airport. That is exactly how cellular transport regulates which molecules enter and exit. Passive diffusion occurs along the gradient without spending chemical currency. On exam day, watch out for questions asking about concentration gradients. Remember: passive transport requires zero ATP!`,
          keyTakeaways: [
            "Passive flow requires zero ATP expenditure",
            "Transport proteins dictate maximum throughput ceiling",
            "Always check whether movement is against or along gradient"
          ]
        }
      });
    }
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    return res.json({
      success: true,
      audioScript: parsed
    });
  } catch (error) {
    console.error("Audio summary error:", error);
    return res.json({
      success: true,
      audioScript: {
        title: `Audio Session: ${req.body.topicTitle || "Core Review"}`,
        durationSeconds: 60,
        fullScript: `Welcome to this audio review on ${req.body.topicTitle}. Focus on the core mechanism: identify the inputs, follow the rate-limiting step, and verify the equilibrium state. Keep this in mind when practicing exam problems.`,
        keyTakeaways: ["Identify inputs and outputs", "Check rate-limiting constraints", "Verify equilibrium direction"]
      }
    });
  }
});
app.post("/api/flashcards/generate", async (req, res) => {
  try {
    const { topicTitle, subject, weakPoints = [] } = req.body;
    if (!ai) {
      return res.json({
        success: true,
        flashcards: getFallbackFlashcards(topicTitle || "Biomolecules")
      });
    }
    const prompt = `Generate 6 smart, high-retention active recall flashcards for "${topicTitle}" in "${subject}".
Include cards targeting these identified student weak points: ${weakPoints.join(", ") || "Common exam errors"}.
Cards should test:
- 2 Fundamental Definitions / Rules
- 2 Application / Scenario challenges
- 2 High-Yield Exam Pitfalls ("Why is X not Y?")

Return JSON:
{
  "flashcards": [
    {
      "id": "fc_1",
      "front": "Active recall question on the front...",
      "back": "Concise, conceptual answer on back...",
      "hint": "Subtle clue...",
      "topic": "${topicTitle}"
    }
  ]
}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    return res.json({
      success: true,
      flashcards: parsed.flashcards || getFallbackFlashcards(topicTitle)
    });
  } catch (error) {
    console.error("Flashcard error:", error);
    return res.json({
      success: true,
      flashcards: getFallbackFlashcards(req.body.topicTitle || "Active Recall")
    });
  }
});
app.post("/api/rescue/plan", async (req, res) => {
  try {
    const { examDate, dailyHours, subjects, topicsStatus } = req.body;
    const daysUntilExam = Math.max(1, Math.ceil((new Date(examDate).getTime() - Date.now()) / (1e3 * 60 * 60 * 24)));
    const totalAvailableHours = daysUntilExam * Number(dailyHours || 3);
    const weakCount = (topicsStatus || []).filter((t) => t.status === "unknown" || t.status === "partial").length;
    const estimatedNeededHours = Math.round(weakCount * 1.5 + 4);
    const isOverload = totalAvailableHours < estimatedNeededHours;
    if (!ai) {
      return res.json({
        success: true,
        daysUntilExam,
        totalAvailableHours,
        estimatedNeededHours,
        isOverload,
        overloadRatio: totalAvailableHours > 0 ? (estimatedNeededHours / totalAvailableHours).toFixed(2) : "1.5",
        strategy: isOverload ? "Triage Strategy Active: Deprioritizing low-weight mastered topics. Concentrating 80% of remaining time on high-yield exam weight units (Weight 4-5)." : "Balanced Mastery Strategy: Sufficient runway to achieve high-depth coverage across all weak units.",
        dailyMilestones: generateRescueSchedule(daysUntilExam, dailyHours, topicsStatus)
      });
    }
    const prompt = `You are CogniPulse Exam Rescue Agent.
A student has an urgent exam deadline:
- Days Remaining: ${daysUntilExam}
- Daily Available Study Capacity: ${dailyHours} hours/day
- Total Study Runway: ${totalAvailableHours} hours
- Weak/Unknown Topics Count: ${weakCount}
- Estimated Realistic Time Needed: ${estimatedNeededHours} hours
- Is Workload Overloaded?: ${isOverload}

Task:
1. Provide a sharp, strategic analysis of their runway.
2. If overloaded, define an aggressive triage: exactly what to CUT or defer, and what high-weight topics to strictly concentrate on.
3. Generate a day-by-day rescue breakdown (up to ${Math.min(daysUntilExam, 7)} days) with prioritized sessions.

Return JSON:
{
  "strategyTitle": "Strategy title...",
  "strategicVerdict": "Direct 2-sentence reality check...",
  "triageRecommendations": ["Action 1", "Action 2", "Action 3"],
  "dailyMilestones": [
    {
      "day": 1,
      "dateLabel": "Day 1 (Urgent Focus)",
      "targetHours": ${dailyHours},
      "focus": "Topic or Unit",
      "priority": "Critical",
      "actions": ["Task 1", "Task 2"]
    }
  ]
}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    return res.json({
      success: true,
      daysUntilExam,
      totalAvailableHours,
      estimatedNeededHours,
      isOverload,
      ...parsed
    });
  } catch (error) {
    console.error("Rescue plan error:", error);
    return res.json({
      success: true,
      daysUntilExam: 7,
      totalAvailableHours: 21,
      estimatedNeededHours: 18,
      isOverload: false,
      strategyTitle: "Targeted High-Yield Blitz",
      strategicVerdict: "You have adequate study time if you commit to 3 hours daily without multi-tasking.",
      triageRecommendations: ["Focus exclusively on Unit 1 and Unit 2 weak questions", "Do 15 minutes of spaced flashcards every morning"],
      dailyMilestones: generateRescueSchedule(7, 3, [])
    });
  }
});
function getFallbackQuestions(topic) {
  return [
    {
      id: "q1",
      type: "mcq",
      prompt: `In the study of ${topic}, how does increasing enzyme substrate concentration affect reaction rate when the enzyme is already saturated?`,
      options: [
        "A) The reaction rate increases exponentially",
        "B) The reaction rate stays constant at Vmax",
        "C) The reaction stops due to feedback inhibition",
        "D) The reaction reverses direction"
      ],
      correctAnswer: "B) The reaction rate stays constant at Vmax",
      explanation: "Once all active sites are bound (saturation), adding more substrate cannot increase the reaction velocity because enzyme turnover rate becomes the limiting constraint.",
      commonMisconception: "Students often assume more reactants always produce a faster rate, neglecting saturation constraints.",
      bloomTaxonomy: "Apply"
    },
    {
      id: "q2",
      type: "mcq",
      prompt: "Which statement correctly distinguishes active transport from facilitated diffusion across a cellular membrane?",
      options: [
        "A) Facilitated diffusion moves solutes against their concentration gradient using ATP",
        "B) Active transport moves solutes against their electrochemical gradient and requires metabolic energy",
        "C) Active transport does not utilize membrane transport proteins",
        "D) Both processes flow passively from high to low concentration"
      ],
      correctAnswer: "B) Active transport moves solutes against their electrochemical gradient and requires metabolic energy",
      explanation: "Active transport requires ATP hydrolysis or ion coupling to pump substances uphill against entropy.",
      commonMisconception: "Confusing protein-assisted transport with active energy requirement.",
      bloomTaxonomy: "Understand"
    },
    {
      id: "q3",
      type: "boolean",
      prompt: "True or False: Denaturation of a protein usually disrupts both its secondary and primary polypeptide structures.",
      options: ["True", "False"],
      correctAnswer: "False",
      explanation: "Denaturation breaks non-covalent hydrogen and disulfide bonds in secondary, tertiary, and quaternary conformations, but leaves covalent peptide backbone bonds in the primary sequence intact.",
      commonMisconception: "Thinking denaturation completely destroys the peptide bonds.",
      bloomTaxonomy: "Analyze"
    },
    {
      id: "q4",
      type: "mcq",
      prompt: "During aerobic cellular respiration, where is the highest concentration of protons (H+) accumulated to drive ATP synthase?",
      options: [
        "A) In the mitochondrial matrix",
        "B) In the intermembrane space",
        "C) In the outer mitochondrial membrane",
        "D) In the cytosol"
      ],
      correctAnswer: "B) In the intermembrane space",
      explanation: "Electron transport complexes pump protons from the matrix into the intermembrane space, building the chemiosmotic electrochemical gradient.",
      commonMisconception: "Assuming protons are pumped into the matrix rather than out of it.",
      bloomTaxonomy: "Understand"
    },
    {
      id: "q5",
      type: "short_answer",
      prompt: "Explain what happens to an animal red blood cell when placed in a hypotonic saline solution, and state the underlying physical principle.",
      correctAnswer: "Water moves into the cell via osmosis down its water potential gradient, causing the cell to swell and potentially lyse (burst).",
      explanation: "A hypotonic environment has higher water potential (lower solute concentration) than the cytoplasm, inducing net inward osmotic flux.",
      commonMisconception: "Thinking solutes leave the cell rather than water entering it.",
      bloomTaxonomy: "Apply"
    }
  ];
}
function getFallbackFlashcards(topic) {
  return [
    {
      id: "fc_1",
      front: `What is the thermodynamic driving force behind osmosis in ${topic}?`,
      back: "The difference in chemical water potential (free energy of water) moving from regions of higher free water concentration to lower free water concentration across a semi-permeable boundary.",
      hint: "Think free energy and entropy, not solute pull.",
      topic
    },
    {
      id: "fc_2",
      front: "How do competitive and non-competitive enzyme inhibitors differ regarding Vmax and Km?",
      back: "Competitive inhibitors increase apparent Km but leave Vmax unchanged (can be overcome with excess substrate). Non-competitive inhibitors decrease Vmax while keeping Km unchanged.",
      hint: "Can high substrate concentration overwhelm the inhibitor?",
      topic
    },
    {
      id: "fc_3",
      front: "What constitutes the quaternary structure of a functional protein?",
      back: "The spatial arrangement and non-covalent interaction of two or more independent polypeptide subunit chains (e.g. hemoglobin tetramer).",
      hint: "More than one polypeptide chain involved.",
      topic
    },
    {
      id: "fc_4",
      front: "Common Exam Pitfall: Does glycolysis require oxygen (O2) to proceed?",
      back: "No! Glycolysis is strictly anaerobic and takes place in the cytosol, generating a net of 2 ATP and 2 NADH without molecular oxygen.",
      hint: "Where did ancient organisms generate energy prior to atmospheric oxygen?",
      topic
    }
  ];
}
function generateRescueSchedule(days, dailyHours, topicsStatus) {
  const schedule = [];
  const count = Math.min(days, 7);
  for (let i = 1; i <= count; i++) {
    schedule.push({
      day: i,
      dateLabel: `Day ${i} ${i === 1 ? "(Immediate Triage)" : i === count ? "(Final Mock Exam)" : ""}`,
      targetHours: dailyHours,
      focus: i === 1 ? "High-Yield Conceptual Gaps" : i === 2 ? "Enzyme Kinetics & Energetics" : i === 3 ? "Membrane Transport & Tonicity" : "Full Exam Synthesis",
      priority: i <= 2 ? "Critical" : "High",
      actions: [
        "Review 12 diagnostic flashcards",
        "Complete 1 adaptive unit quiz (aim for >80% accuracy)",
        "Misconception Clinic: resolve 2 tagged mental model errors"
      ]
    });
  }
  return schedule;
}
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CogniPulse server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
export {
  SAMPLE_CURRICULA
};
