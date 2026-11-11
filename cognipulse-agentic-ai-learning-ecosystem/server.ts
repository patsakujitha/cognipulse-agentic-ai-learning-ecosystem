import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import {
  normalizeAnswer,
  stripOptionPrefix,
  validateAndNormalizeQuestion,
  gradeQuizAnswer,
} from './src/utils/quizGrading.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));

// Server-side Gemini initialization
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.error('Failed to initialize GoogleGenAI:', err);
  }
}

// Resilient Gemini generator with automatic fallback to gemini-3.1-flash-lite on demand spikes
export async function generateWithFallback(options: {
  contents: any;
  config?: any;
  primaryModel?: string;
}) {
  if (!ai) {
    throw new Error('Gemini API client is not initialized. Please ensure GEMINI_API_KEY is configured in your Secrets panel.');
  }
  const primary = options.primaryModel || 'gemini-3.8-flash';
  const fallback = 'gemini-3.1-flash-lite';

  const primaryConfig = { ...(options.config || {}) };
  if (primary === 'gemini-3.8-flash' && !primaryConfig.thinkingConfig) {
    primaryConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
  }

  const fallbackConfig = { ...(options.config || {}) };
  delete fallbackConfig.thinkingConfig;

  try {
    return await ai.models.generateContent({
      model: primary,
      contents: options.contents,
      config: primaryConfig,
    });
  } catch (err: any) {
    const errMsg = String(err?.message || err || '');
    const isDemandOrRate =
      errMsg.includes('503') ||
      errMsg.includes('UNAVAILABLE') ||
      errMsg.includes('high demand') ||
      errMsg.includes('429') ||
      errMsg.includes('RESOURCE_EXHAUSTED') ||
      errMsg.includes('quota') ||
      errMsg.includes('overloaded');

    if (isDemandOrRate && primary !== fallback) {
      console.warn(`[Gemini] ${primary} experienced high demand / unavailable. Falling back seamlessly to ${fallback}...`);
      try {
        return await ai.models.generateContent({
          model: fallback,
          contents: options.contents,
          config: fallbackConfig,
        });
      } catch (fallbackErr: any) {
        const fbMsg = String(fallbackErr?.message || fallbackErr || '');
        if (fbMsg.includes('503') || fbMsg.includes('429') || fbMsg.includes('high demand')) {
          console.warn(`[Gemini] Retrying ${fallback} once after brief backoff...`);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          return await ai.models.generateContent({
            model: fallback,
            contents: options.contents,
            config: fallbackConfig,
          });
        }
        throw fallbackErr;
      }
    }
    throw err;
  }
}

// Resilient Gemini streaming generator with automatic fallback to gemini-3.1-flash-lite on demand spikes
export async function generateStreamWithFallback(options: {
  contents: any;
  config?: any;
  primaryModel?: string;
}) {
  if (!ai) {
    throw new Error('Gemini API client is not initialized. Please ensure GEMINI_API_KEY is configured in your Secrets panel.');
  }
  const primary = options.primaryModel || 'gemini-3.8-flash';
  const fallback = 'gemini-3.1-flash-lite';

  const primaryConfig = { ...(options.config || {}) };
  if (primary === 'gemini-3.8-flash' && !primaryConfig.thinkingConfig) {
    primaryConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
  }

  const fallbackConfig = { ...(options.config || {}) };
  delete fallbackConfig.thinkingConfig;

  try {
    return await ai.models.generateContentStream({
      model: primary,
      contents: options.contents,
      config: primaryConfig,
    });
  } catch (err: any) {
    const errMsg = String(err?.message || err || '');
    const isDemandOrRate =
      errMsg.includes('503') ||
      errMsg.includes('UNAVAILABLE') ||
      errMsg.includes('high demand') ||
      errMsg.includes('429') ||
      errMsg.includes('RESOURCE_EXHAUSTED') ||
      errMsg.includes('quota') ||
      errMsg.includes('overloaded');

    if (isDemandOrRate && primary !== fallback) {
      console.warn(`[Gemini Stream] ${primary} experienced high demand. Falling back to ${fallback}...`);
      return await ai.models.generateContentStream({
        model: fallback,
        contents: options.contents,
        config: fallbackConfig,
      });
    }
    throw err;
  }
}

// -------------------------------------------------------------
// Fallback Curricula for instant demo / zero-friction onboarding
// -------------------------------------------------------------
export const SAMPLE_CURRICULA = {
  biology: {
    subject: 'AP Biology & Molecular Genetics',
    description: 'Comprehensive college-prep biology covering biochemistry, cellular energetics, genetics, and natural selection.',
    totalEstimatedHours: 48,
    units: [
      {
        id: 'u1',
        title: 'Unit 1: Chemistry of Life & Cell Structure',
        weight: 4,
        topics: [
          {
            id: 't1_1',
            title: 'Macromolecules & Polypeptide Folding',
            subtopics: ['Hydrogen bonding in proteins', 'Tertiary and quaternary structure', 'Denaturation triggers'],
            difficulty: 'medium',
            estimatedMins: 75,
            studyNotes: 'Proteins are polymers of 20 amino acids joined by peptide bonds. Secondary structure is driven by hydrogen bonds (alpha-helices and beta-sheets), while tertiary structure is formed by R-group interactions. Denaturation disrupts secondary and tertiary folding, eliminating biological function without cleaving primary peptide covalent bonds.',
            youtubeLinks: [
              { title: 'Biological Molecules - You Are What You Eat', url: 'https://www.youtube.com/watch?v=H8WJ2KENlK0', channel: 'CrashCourse' },
              { title: 'Biomolecules (Updated)', url: 'https://www.youtube.com/watch?v=YO244P1e9QM', channel: 'Amoeba Sisters' },
              { title: 'Introduction to Protein Structure & Folding', url: 'https://www.youtube.com/watch?v=wvTv8TqWC4o', channel: 'Khan Academy' },
            ],
          },
          {
            id: 't1_2',
            title: 'Membrane Permeability & Osmoregulation',
            subtopics: ['Phospholipid bilayer fluidity', 'Active vs Passive transport', 'Water potential & Tonicity'],
            difficulty: 'hard',
            estimatedMins: 90,
            studyNotes: 'The phospholipid bilayer allows small non-polar molecules (O2, CO2) to diffuse passively. Water flows from high water potential (hypotonic) to low water potential (hypertonic). Active transport pumps ions against electrochemical gradients by hydrolyzing ATP.',
            youtubeLinks: [
              { title: 'In Da Club - Membranes & Transport', url: 'https://www.youtube.com/watch?v=dPKvHrD1e8g', channel: 'CrashCourse' },
              { title: 'Cell Transport: Osmosis & Diffusion', url: 'https://www.youtube.com/watch?v=Ptmlvtei8hw', channel: 'Amoeba Sisters' },
              { title: 'Cell Membranes and Water Potential', url: 'https://www.youtube.com/watch?v=qBCVVszQQNs', channel: 'Bozeman Science' },
            ],
          },
          {
            id: 't1_3',
            title: 'Cellular Compartmentalization',
            subtopics: ['Endosymbiotic theory', 'Endomembrane trafficking', 'Mitochondrial surface area'],
            difficulty: 'easy',
            estimatedMins: 50,
            studyNotes: 'Eukaryotic cells segregate metabolic reactions in membrane-bound organelles. Endosymbiotic theory explains mitochondrial and chloroplast origins (double membranes, circular DNA, 70S ribosomes). Highly folded internal membranes (cristae/thylakoids) maximize ATP generation surface area.',
            youtubeLinks: [
              { title: 'Endosymbiosis and Eukaryotic Cell Evolution', url: 'https://www.youtube.com/watch?v=FcxzT9bJst0', channel: 'Khan Academy' },
              { title: 'Endosymbiotic Theory', url: 'https://www.youtube.com/watch?v=FGnS-Xk0ZqU', channel: 'Amoeba Sisters' },
              { title: 'Eukaryopolis - The City of Animal Cells', url: 'https://www.youtube.com/watch?v=cj8dDTHGJBY', channel: 'CrashCourse' },
            ],
          },
        ],
      },
      {
        id: 'u2',
        title: 'Unit 2: Cellular Energetics & Metabolism',
        weight: 5,
        topics: [
          {
            id: 't2_1',
            title: 'Enzyme Kinetics & Allosteric Regulation',
            subtopics: ['Activation energy & catalysts', 'Competitive vs Non-competitive inhibition', 'Feedback loops'],
            difficulty: 'hard',
            estimatedMins: 90,
            studyNotes: 'Enzymes lower the activation energy (Ea) barrier without altering reaction delta-G. Competitive inhibitors bind the active site (Vmax can still be reached with high substrate). Non-competitive inhibitors bind allosteric sites, changing enzyme shape and permanently reducing Vmax.',
            youtubeLinks: [
              { title: 'Enzymes: Biological Catalysts & Kinetics', url: 'https://www.youtube.com/watch?v=qgVFkRn8f10', channel: 'Amoeba Sisters' },
              { title: 'Introduction to Enzymes and Catalysis', url: 'https://www.youtube.com/watch?v=Gk7f113_d20', channel: 'Khan Academy' },
              { title: 'Enzyme Inhibition (Competitive vs Noncompetitive)', url: 'https://www.youtube.com/watch?v=gT1T35eZ2hE', channel: 'AK Lectures' },
            ],
          },
          {
            id: 't2_2',
            title: 'Photosynthesis & Light Reactions',
            subtopics: ['Chlorophyll excitation', 'Calvin cycle carbon fixation', 'Photorespiration'],
            difficulty: 'hard',
            estimatedMins: 110,
            studyNotes: 'Light reactions in thylakoids photolyze water to generate ATP and NADPH via chemiosmotic proton gradients. The Calvin cycle in the stroma uses RuBisCO to fix CO2 into G3P using chemical energy produced by the light reactions.',
            youtubeLinks: [
              { title: 'Photosynthesis: Crash Course Biology #8', url: 'https://www.youtube.com/watch?v=sQK3Yr4Sc_k', channel: 'CrashCourse' },
              { title: 'Photosynthesis and Pigment Reactions', url: 'https://www.youtube.com/watch?v=uixA8ZXx0KU', channel: 'Amoeba Sisters' },
              { title: 'Photosynthesis - Light Reactions and Calvin Cycle', url: 'https://www.youtube.com/watch?v=g78utcLQrJ4', channel: 'Bozeman Science' },
            ],
          },
          {
            id: 't2_3',
            title: 'Cellular Respiration & Chemiosmosis',
            subtopics: ['Glycolysis & Krebs cycle', 'Proton gradient in ATP synthase', 'Anaerobic fermentation'],
            difficulty: 'hard',
            estimatedMins: 100,
            studyNotes: 'Glycolysis in the cytosol breaks glucose into 2 pyruvates without oxygen. The Krebs cycle in the mitochondrial matrix oxidizes acetyl-CoA into NADH/FADH2. The electron transport chain pumps protons into the intermembrane space, powering ATP synthase. Oxygen acts as terminal electron acceptor.',
            youtubeLinks: [
              { title: 'ATP & Respiration: Crash Course Biology #7', url: 'https://www.youtube.com/watch?v=00jbG_cfGuQ', channel: 'CrashCourse' },
              { title: 'Cellular Respiration and the Mighty Mitochondria', url: 'https://www.youtube.com/watch?v=4Eo7Jt65Z2M', channel: 'Amoeba Sisters' },
              { title: 'Cellular Respiration Overview & Chemiosmosis', url: 'https://www.youtube.com/watch?v=2f7YwCtHcgk', channel: 'Khan Academy' },
            ],
          },
        ],
      },
      {
        id: 'u3',
        title: 'Unit 3: Gene Expression & Heredity',
        weight: 5,
        topics: [
          {
            id: 't3_1',
            title: 'DNA Replication & Proofreading',
            subtopics: ['Leading vs lagging strand', 'DNA polymerases and topoisomerase', 'Telomeres'],
            difficulty: 'medium',
            estimatedMins: 80,
            studyNotes: 'Replication is semi-conservative. DNA polymerase synthesizes only in the 5\' to 3\' direction, producing a continuous leading strand and discontinuous lagging Okazaki fragments sealed by ligase. Topoisomerase prevents torsional supercoiling ahead of helicase.',
            youtubeLinks: [
              { title: 'DNA Structure and Replication: Crash Course Biology', url: 'https://www.youtube.com/watch?v=8kK2zwjRV0M', channel: 'CrashCourse' },
              { title: 'DNA Replication (Updated) - Enzymes and Strands', url: 'https://www.youtube.com/watch?v=Qqe4thU-os8', channel: 'Amoeba Sisters' },
              { title: 'Leading and Lagging Strands in DNA Replication', url: 'https://www.youtube.com/watch?v=TEQMeP9GG6M', channel: 'Khan Academy' },
            ],
          },
          {
            id: 't3_2',
            title: 'Transcription & Post-Transcriptional Processing',
            subtopics: ['Promoters and transcription factors', 'Intron splicing and poly-A tail', 'Alternative RNA splicing'],
            difficulty: 'medium',
            estimatedMins: 85,
            studyNotes: 'RNA polymerase synthesizes pre-mRNA from template DNA. Eukaryotes add a 5\' GTP cap and 3\' poly-A tail, while spliceosomes remove non-coding introns. Alternative RNA splicing enables one gene to encode multiple distinct protein variants.',
            youtubeLinks: [
              { title: 'DNA, Transcription & Translation - Protein Synthesis', url: 'https://www.youtube.com/watch?v=itsb2SqR-R0', channel: 'CrashCourse' },
              { title: 'Protein Synthesis (Updated) - Transcription & Translation', url: 'https://www.youtube.com/watch?v=oefAI2x2CQM', channel: 'Amoeba Sisters' },
              { title: 'Transcription and Translation in Detail', url: 'https://www.youtube.com/watch?v=h5mJbP23Buo', channel: 'Bozeman Science' },
            ],
          },
          {
            id: 't3_3',
            title: 'Mendelian Genetics & Gene Linkage',
            subtopics: ['Punnett squares & dihybrid crosses', 'Crossing over recombination frequency', 'Sex-linked inheritance'],
            difficulty: 'hard',
            estimatedMins: 95,
            studyNotes: 'Mendel\'s laws govern independent assortment for unlinked genes. Closely linked genes on the same chromosome violate 9:3:3:1 ratios and only recombine via crossing over in prophase I. Recombination frequency below 50% diagnoses genetic linkage.',
            youtubeLinks: [
              { title: 'Heredity: Crash Course Biology #9', url: 'https://www.youtube.com/watch?v=CBezq1fFUEw', channel: 'CrashCourse' },
              { title: 'Mendelian Genetics and Punnett Squares', url: 'https://www.youtube.com/watch?v=me07J2EwN0U', channel: 'Amoeba Sisters' },
              { title: 'Chromosomal Genetics and Gene Linkage', url: 'https://www.youtube.com/watch?v=1F2b_Q2k8sQ', channel: 'Bozeman Science' },
            ],
          },
        ],
      },
    ],
  },
  cs: {
    subject: 'Data Structures & Algorithmic Analysis',
    description: 'Foundations of computer science algorithms, complexity analysis, trees, graphs, and dynamic programming.',
    totalEstimatedHours: 42,
    units: [
      {
        id: 'cs_u1',
        title: 'Unit 1: Asymptotic Analysis & Linear Structures',
        weight: 4,
        topics: [
          {
            id: 'cs_t1',
            title: 'Big-O, Big-Omega & Amortized Analysis',
            subtopics: ['Worst-case vs average-case', 'Amortized cost of dynamic array doubling', 'Logarithmic runtime'],
            difficulty: 'medium',
            estimatedMins: 60,
            studyNotes: 'Big-O describes asymptotic upper bounds. Dynamic arrays double capacity upon overflow, delivering O(1) amortized insertion cost despite occasional O(N) reallocation copies. Divide-and-conquer algorithms with halved subproblems typically run in O(log N).',
            youtubeLinks: [
              { title: 'MIT 6.006: Asymptotic Complexity & Big O', url: 'https://www.youtube.com/watch?v=ZA-tUyM_y7s', channel: 'MIT OpenCourseWare' },
              { title: 'Computational Complexity & Big O', url: 'https://www.youtube.com/watch?v=0IAPZzGSbME', channel: 'CS50' },
              { title: 'Big O Notation Full Course', url: 'https://www.youtube.com/watch?v=Mo4vesaut8g', channel: 'freeCodeCamp' },
            ],
          },
          {
            id: 'cs_t2',
            title: 'Linked Lists, Stacks & Queues',
            subtopics: ['Singly vs Doubly linked nodes', 'Stack-based expression parsing', 'Ring buffer queue implementation'],
            difficulty: 'easy',
            estimatedMins: 50,
            studyNotes: 'Linked lists provide O(1) prepend/append when tail pointer is kept, but O(N) random indexing. Stacks (LIFO) model recursion and matching parentheses. Queues (FIFO) facilitate breadth-first exploration and buffering.',
            youtubeLinks: [
              { title: 'Data Structures - Linked Lists in Detail', url: 'https://www.youtube.com/watch?v=WwfhLC16bis', channel: 'freeCodeCamp' },
              { title: 'Stacks, Queues, Linked Lists Explained', url: 'https://www.youtube.com/watch?v=4IrUAqYKjIA', channel: 'CS50' },
              { title: 'Linked List Data Structure & Operations', url: 'https://www.youtube.com/watch?v=dwUhy7J_V-8', channel: 'Abdul Bari' },
            ],
          },
        ],
      },
      {
        id: 'cs_u2',
        title: 'Unit 2: Non-Linear Structures & Graph Traversals',
        weight: 5,
        topics: [
          {
            id: 'cs_t3',
            title: 'Binary Search Trees & AVL Balancing',
            subtopics: ['BST invariant & searching', 'Rotations in balanced trees', 'In-order traversal properties'],
            difficulty: 'hard',
            estimatedMins: 90,
            studyNotes: 'BST invariant: Left subtree < Root < Right subtree. In-order traversal produces sorted order. AVL trees maintain balance factor between -1 and +1 using single/double rotations, guaranteeing strict O(log N) worst-case lookups.',
            youtubeLinks: [
              { title: 'Binary Search Tree Tutorial & Implementation', url: 'https://www.youtube.com/watch?v=f5dU3xoE6ms', channel: 'freeCodeCamp' },
              { title: 'AVL Tree - Insertion and Rotations Step by Step', url: 'https://www.youtube.com/watch?v=jDM6_TnYIqE', channel: 'Abdul Bari' },
              { title: 'Binary Search Trees & BST Sort', url: 'https://www.youtube.com/watch?v=9Jry5-82I68', channel: 'MIT OpenCourseWare' },
            ],
          },
          {
            id: 'cs_t4',
            title: 'Graph Traversal (BFS & DFS)',
            subtopics: ['Adjacency matrix vs list', 'Cycle detection with 3-color DFS', 'Shortest path with Dijkstra'],
            difficulty: 'hard',
            estimatedMins: 105,
            studyNotes: 'BFS uses a FIFO queue to discover shortest paths in unweighted graphs. DFS uses a stack/recursion for topological sorting and cycle detection. Adjacency lists save space (O(V+E)) compared to dense matrices (O(V^2)).',
            youtubeLinks: [
              { title: 'Graph Traversals: BFS and DFS Explained', url: 'https://www.youtube.com/watch?v=tWVWeAqZ0WU', channel: 'freeCodeCamp' },
              { title: 'Breadth First Search and Depth First Search', url: 'https://www.youtube.com/watch?v=pcKY4hjDrxk', channel: 'Abdul Bari' },
              { title: 'Breadth First Search Algorithm & Animation', url: 'https://www.youtube.com/watch?v=oDqjPvD54Ss', channel: 'WilliamFiset' },
            ],
          },
        ],
      },
      {
        id: 'cs_u3',
        title: 'Unit 3: Dynamic Programming & Greedy Algorithms',
        weight: 5,
        topics: [
          {
            id: 'cs_t5',
            title: 'Optimal Substructure & Memoization',
            subtopics: ['Overlapping subproblems', 'Top-down vs Bottom-up tabulations', '0/1 Knapsack problem'],
            difficulty: 'hard',
            estimatedMins: 120,
            studyNotes: 'Dynamic programming optimizes recursive branching by caching overlapping subproblem results. Requires optimal substructure (optimal solution composed of optimal sub-solutions). Knapsack DP balances item weights against values in O(N*W) time.',
            youtubeLinks: [
              { title: 'Dynamic Programming: Learn to Solve Algorithmic Problems', url: 'https://www.youtube.com/watch?v=oBt53YbR9Kk', channel: 'freeCodeCamp' },
              { title: 'MIT 6.006: Dynamic Programming I - Fibonacci & Shortest Paths', url: 'https://www.youtube.com/watch?v=OQ5jsbhAv_M', channel: 'MIT OpenCourseWare' },
              { title: '0/1 Knapsack Problem using Dynamic Programming', url: 'https://www.youtube.com/watch?v=nLmhmB6NzcM', channel: 'Abdul Bari' },
            ],
          },
        ],
      },
    ],
  },
};

// -------------------------------------------------------------
// High-Precision Structural Syllabus Parser (Zero Omissions)
// -------------------------------------------------------------
export function parseSyllabusFromText(rawText: string, fallbackSubject?: string): any | null {
  if (!rawText || rawText.trim().length < 10) return null;

  const rawLines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (rawLines.length === 0) return null;

  let detectedSubject = fallbackSubject || '';
  const units: Array<{
    id: string;
    title: string;
    weight: number;
    topics: Array<{
      id: string;
      title: string;
      subtopics: string[];
      difficulty: string;
      estimatedMins: number;
      studyNotes: string;
      youtubeLinks: Array<{ title: string; url: string; channel: string }>;
    }>;
  }> = [];

  let currentUnit: {
    id: string;
    title: string;
    weight: number;
    topics: any[];
  } | null = null;

  let currentTopic: any | null = null;

  // Pattern detection regexes
  const subjectRegex = /^(?:course|subject|curriculum|syllabus|class|module)\s*[:\-]\s*(.+)$/i;
  const unitRegex = /^(?:unit|chapter|module|part|week|section)\s*(\d+|[ivxlcdm]+|\w+)\s*[:\-–.]\s*(.+)$/i;
  const bareUnitRegex = /^(?:unit|chapter|module|part|week|section)\s*(\d+|[ivxlcdm]+|\w+)$/i;
  const topicRegex = /^(?:topic\s*)?(\d+(?:\.\d+)+|\d+)\s*[:\-–.]\s*(.+)$/i;
  const namedTopicRegex = /^topic\s*[:\-–.]\s*(.+)$/i;
  const bulletTopicRegex = /^(?:[•*\-–]|(?:\d+\.))\s*(.+)$/;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Detect Course / Subject name
    if (!detectedSubject) {
      const subjMatch = line.match(subjectRegex);
      if (subjMatch) {
        detectedSubject = subjMatch[1].trim();
        continue;
      }
      if (i === 0 && !line.match(unitRegex) && !line.match(topicRegex) && !line.match(bulletTopicRegex)) {
        detectedSubject = line.replace(/^[#\s]+/, '').trim();
        continue;
      }
    }

    // Detect Unit / Chapter / Module
    const unitMatch = line.match(unitRegex) || line.match(bareUnitRegex);
    if (unitMatch) {
      const unitNum = units.length + 1;
      const unitTitle = unitMatch[2] ? `Unit ${unitMatch[1]}: ${unitMatch[2].trim()}` : `Unit ${unitMatch[1]}`;
      currentUnit = {
        id: `u_${unitNum}`,
        title: unitTitle,
        weight: 4,
        topics: [],
      };
      units.push(currentUnit);
      currentTopic = null;
      continue;
    }

    // Detect Topic
    const topicMatch = line.match(topicRegex) || line.match(namedTopicRegex);
    if (topicMatch) {
      if (!currentUnit) {
        currentUnit = {
          id: `u_${units.length + 1}`,
          title: `Unit ${units.length + 1}: Core Concepts`,
          weight: 4,
          topics: [],
        };
        units.push(currentUnit);
      }

      let rawTitle = topicMatch[2] ? topicMatch[2].trim() : topicMatch[1].trim();
      let extractedSubtopics: string[] = [];

      // Detect embedded parenthetical subtopics, e.g. "Hybridization (sp3, sp2, sp, VSEPR)"
      const parenMatch = rawTitle.match(/^(.+?)\s*\(([^)]+)\)$/);
      if (parenMatch) {
        rawTitle = parenMatch[1].trim();
        extractedSubtopics = parenMatch[2].split(/[,;]/).map((s) => s.trim()).filter((s) => s.length > 0);
      }

      const topicNum = currentUnit.topics.length + 1;
      currentTopic = {
        id: `t_${units.length}_${topicNum}`,
        title: rawTitle,
        subtopics: extractedSubtopics,
        difficulty: 'medium',
        estimatedMins: 60,
        studyNotes: '',
        youtubeLinks: [],
      };
      currentUnit.topics.push(currentTopic);
      continue;
    }

    // Detect Bullet items
    const bulletMatch = line.match(bulletTopicRegex);
    if (bulletMatch) {
      const content = bulletMatch[1].trim();
      if (currentTopic && (line.startsWith(' ') || line.startsWith('\t') || currentTopic.subtopics.length > 0)) {
        currentTopic.subtopics.push(content);
      } else {
        if (!currentUnit) {
          currentUnit = {
            id: `u_${units.length + 1}`,
            title: `Unit ${units.length + 1}: Foundational Module`,
            weight: 4,
            topics: [],
          };
          units.push(currentUnit);
        }
        const topicNum = currentUnit.topics.length + 1;
        currentTopic = {
          id: `t_${units.length}_${topicNum}`,
          title: content,
          subtopics: [],
          difficulty: 'medium',
          estimatedMins: 60,
          studyNotes: '',
          youtubeLinks: [],
        };
        currentUnit.topics.push(currentTopic);
      }
      continue;
    }

    // Subtopic lines under current topic
    if (currentTopic && (line.startsWith(' ') || line.startsWith('-') || line.startsWith('•'))) {
      currentTopic.subtopics.push(line.replace(/^[•*\-\s]+/, '').trim());
    }
  }

  if (!detectedSubject) {
    detectedSubject = fallbackSubject || 'Course Curriculum';
  }

  // Ensure every topic has at least 3 high-yield subtopics, study notes, and educational YouTube links
  let totalTopics = 0;
  for (const u of units) {
    totalTopics += u.topics.length;
    for (const t of u.topics) {
      if (!t.subtopics || t.subtopics.length === 0) {
        t.subtopics = [
          `Fundamental principles of ${t.title}`,
          `Governing mechanics, formulas, and operational workflows`,
          `High-yield exam applications and boundary edge cases`,
        ];
      }
      t.studyNotes = `• Core Definition: Foundational terminology and definitions of ${t.title}.\n• Governing Mechanism / Constraint: Central laws, structural relationships, or mathematical formulations.\n• High-Yield Exam Trap: Common student misconception and edge-case boundary verification for ${t.title}.`;
      t.youtubeLinks = [
        {
          title: `${t.title} - Comprehensive Conceptual Lecture`,
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${detectedSubject} ${t.title} tutorial`)}`,
          channel: 'Khan Academy',
        },
        {
          title: `${t.title} - High-Yield Review & Applications`,
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${detectedSubject} ${t.title} crash course`)}`,
          channel: 'CrashCourse',
        },
        {
          title: `${t.title} - Deep Dive Lecture & Problem Solving`,
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${detectedSubject} ${t.title} lecture`)}`,
          channel: 'MIT OpenCourseWare',
        },
      ];
    }
  }

  if (units.length === 0 || totalTopics === 0) {
    return null;
  }

  return {
    subject: detectedSubject,
    description: `Comprehensive structured curriculum for ${detectedSubject} covering ${units.length} core units and ${totalTopics} key topics.`,
    totalEstimatedHours: Math.max(15, Math.round(totalTopics * 1.5)),
    units,
  };
}

// -------------------------------------------------------------
// 1. AI Syllabus Analyzer API (PDF, OCR, JPG, PNG & Text)
// -------------------------------------------------------------
app.post('/api/syllabus/analyze', async (req: Request, res: Response) => {
  try {
    const { syllabusText, fileBase64, mimeType, fileName, sampleId } = req.body;

    // Handle template samples immediately
    if (sampleId && (sampleId === 'biology' || sampleId === 'cs')) {
      const sample = SAMPLE_CURRICULA[sampleId as keyof typeof SAMPLE_CURRICULA];
      if (sample) {
        return res.json({
          success: true,
          source: 'sample_curriculum',
          curriculum: sample,
        });
      }
    }

    const rawText = syllabusText ?? req.body.text ?? req.body.content ?? req.body.outline ?? '';
    let extractedText = typeof rawText === 'string' ? rawText.trim() : '';
    let cleanBase64: string | null = null;
    let normalizedMime: string = 'image/jpeg';
    let isFileProvided = false;

    const rawFileBase64 = fileBase64 ?? req.body.file ?? req.body.fileData ?? req.body.base64;
    if (typeof rawFileBase64 === 'string' && rawFileBase64.trim().length > 50) {
      // Determine mime type from data URL if available
      const dataUriMatch = rawFileBase64.match(/^data:([^;]+);base64,/);
      let detectedMime = mimeType || req.body.type || (dataUriMatch ? dataUriMatch[1] : '');

      cleanBase64 = rawFileBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');

      if (cleanBase64.length > 50) {
        // If file is text-based (txt, markdown, csv, json)
        const lowerMime = (detectedMime || '').toLowerCase();
        const lowerName = (fileName || '').toLowerCase();
        const isTextDoc =
          lowerMime.includes('text/') ||
          lowerMime.includes('markdown') ||
          lowerMime.includes('json') ||
          lowerMime.includes('csv') ||
          lowerName.endsWith('.txt') ||
          lowerName.endsWith('.md');

        if (isTextDoc) {
          try {
            const decodedText = Buffer.from(cleanBase64, 'base64').toString('utf-8');
            if (decodedText.trim().length > 10) {
              extractedText = extractedText ? `${extractedText}\n\n${decodedText}` : decodedText;
              cleanBase64 = null; // Process directly as rich text
            }
          } catch (e) {
            console.warn('Failed to decode base64 as text:', e);
          }
        } else {
          // Normalize mime type for Gemini multimodal inlineData
          isFileProvided = true;
          if (lowerMime.includes('pdf') || lowerName.endsWith('.pdf')) {
            normalizedMime = 'application/pdf';
          } else if (lowerMime.includes('png') || lowerName.endsWith('.png')) {
            normalizedMime = 'image/png';
          } else if (lowerMime.includes('webp') || lowerName.endsWith('.webp')) {
            normalizedMime = 'image/webp';
          } else {
            normalizedMime = 'image/jpeg';
          }
        }
      }
    }

    const hasFile = isFileProvided && cleanBase64 !== null && cleanBase64.length > 50;
    const hasText = extractedText.length >= 10;

    if (!hasFile && !hasText) {
      return res.status(400).json({
        success: false,
        error: 'Please upload a syllabus file (PDF, PNG, JPG, WEBP, TXT) or paste curriculum outline text.',
      });
    }

    if (!ai && !hasText) {
      return res.status(503).json({
        success: false,
        error: 'Optical character recognition is currently initializing. Please paste your curriculum outline or topic list to extract the syllabus.',
      });
    }

    const ocrInstruction = hasFile
      ? `You are an expert optical character recognition (OCR) curriculum extraction engine and academic syllabus architect.
You are given an uploaded document or image (PDF, scanned syllabus, photo of curriculum, textbook table of contents, lecture outline, or academic schedule).

CORE OCR & EXTRACTION DIRECTIVES (CRITICAL - HIGHEST FIDELITY):
1. HIGH-PRECISION OCR: Read every line across the document from top to bottom, including multi-column formats, tables, schedules, bullet points, headers, chapter numbers, topic titles, and subtopics.
2. ZERO OMISSIONS: You MUST extract ALL units/modules/chapters and ALL topics and subtopics present in the document. Do NOT skip any topic. Do NOT write "etc." or summarize away topics. Every topic in the document MUST appear in the output.
3. HIERARCHICAL RECONSTRUCTION:
   - Identify the exact Course / Subject Title (e.g. "Linear Algebra & Differential Equations", "AP World History: Modern", "Organic Chemistry I").
   - Extract an insightful, academic Course Description capturing the curriculum scope, objectives, and prerequisites.
   - Group the curriculum into Units (or Modules/Chapters). If the document divides content into Units, Chapters, Weeks, or Modules, preserve that exact division. If the document has a flat list of topics, group them into logically coherent thematic units (e.g. 3 to 6 units).
   - For every unit, assign an exam Weight (integer 1 to 5, where 5 is high-yield / heavily tested).
   - Under each unit, extract all specific Topics.
   - Under each topic, extract an exhaustive list of "subtopics" (all specific concepts, theorems, formulas, reaction mechanisms, case studies, or competencies mentioned in the text for that topic). If the document does not list subtopics for a topic, supply 3-5 specific, accurate, standard academic subtopics for that topic.
4. STUDY NOTES & EDUCATIONAL RESOURCES:
   - For every topic, provide "studyNotes": 3-5 clear, high-yield bullet points covering:
     • Fundamental Definition: core definition with precise academic terminology
     • Core Mechanism / Governing Formula: the mathematical formula, reaction step, or operational mechanism
     • Common Exam Trap / Misconception: what students frequently confuse or misapply on exams
   - For every topic, provide "youtubeLinks": exactly 3 real, reputable educational YouTube video links from top channels (Khan Academy, CrashCourse, MIT OpenCourseWare, 3Blue1Brown, freeCodeCamp, Organic Chemistry Tutor, Bozeman Science, Stanford Online, etc.) with accurate title, search URL, and channel name.
5. NON-SYLLABUS / CORRUPTED INPUT DETECTION:
   - If the uploaded image/document is completely blank, corrupted, or completely devoid of any academic or educational syllabus content, set the "error" field in the JSON to: "The uploaded file does not contain a recognizable course syllabus or academic topics. Please upload a curriculum outline, syllabus document, or table of contents." and leave units empty.`
      : `You are an expert academic curriculum architect and syllabus parsing engine.
You are given a syllabus text outline or course curriculum description.

CORE EXTRACTION DIRECTIVES (CRITICAL - HIGHEST FIDELITY):
1. ZERO OMISSIONS: Carefully parse the entire text from start to finish. Extract ALL units/modules/chapters and ALL topics and subtopics without skipping any.
2. HIERARCHICAL RECONSTRUCTION:
   - Course / Subject Title: Identify the full formal subject name.
   - Course Description: Provide a crisp 2-3 sentence overview of the course scope and competencies.
   - Units: Preserve all units/modules. If the input is an unstructured or flat list of topics, organize them into 3 to 6 logically structured thematic units.
   - Topics & Subtopics: Extract every topic. Under each topic, extract all listed subtopics (concepts, formulas, rules, mechanisms). If subtopics are not explicitly bulleted, infer 3-5 specific, standard subtopics.
   - For each topic, provide high-yield "studyNotes" (fundamental definition, core formula/mechanism, and common exam trap) and 3 real educational "youtubeLinks" (Khan Academy, CrashCourse, MIT OpenCourseWare, etc.).
3. NON-SYLLABUS INPUT:
   - If the input text is random gibberish, spam, or contains no educational topics or subject content, set the "error" field to: "The provided text does not contain an identifiable course syllabus or academic topics. Please paste a course outline or syllabus."`;

    const prompt = `${ocrInstruction}

${hasText ? `CURRICULUM TEXT OUTLINE TO PARSE:\n"""\n${extractedText.slice(0, 30000)}\n"""` : 'Please perform optical character recognition on the attached syllabus document and extract all curriculum units, topics, and subtopics.'}

Return valid structured JSON matching the schema with full accuracy, zero omissions, and complete topic coverage.`;

    const syllabusSchema = {
      type: Type.OBJECT,
      properties: {
        error: {
          type: Type.STRING,
          description: 'Empty string if syllabus was successfully extracted. If image or text does not contain a syllabus, output the error message here.',
        },
        subject: {
          type: Type.STRING,
          description: 'Full course or subject name',
        },
        description: {
          type: Type.STRING,
          description: 'Clear, concise course scope and learning objectives',
        },
        totalEstimatedHours: {
          type: Type.INTEGER,
          description: 'Estimated total study hours (e.g. 30 to 60)',
        },
        units: {
          type: Type.ARRAY,
          description: 'All extracted curriculum units or chapters without omission',
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              weight: { type: Type.INTEGER },
              topics: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    subtopics: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    difficulty: { type: Type.STRING },
                    estimatedMins: { type: Type.INTEGER },
                    studyNotes: { type: Type.STRING },
                    youtubeLinks: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING },
                          url: { type: Type.STRING },
                          channel: { type: Type.STRING },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const contents: any[] = [];
    if (hasFile && cleanBase64) {
      contents.push({
        inlineData: {
          mimeType: normalizedMime,
          data: cleanBase64,
        },
      });
    }
    contents.push({ text: prompt });

    let parsed: any = null;
    let extractionSource = 'gemini-ocr-engine';

    if (ai) {
      try {
        const timeoutMs = hasFile ? 25000 : 7000;
        const geminiPromise = generateWithFallback({
          primaryModel: 'gemini-3.8-flash',
          contents: contents,
          config: {
            responseMimeType: 'application/json',
            responseSchema: syllabusSchema,
          },
        });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI extraction timed out, switching to high-precision parser')), timeoutMs)
        );

        const response: any = await Promise.race([geminiPromise, timeoutPromise]);
        const text = response.text || '{}';
        parsed = JSON.parse(text);
        if (parsed.units && Array.isArray(parsed.units) && parsed.units.length > 0) {
          extractionSource = 'gemini-ocr-engine';
        }
      } catch (geminiErr: any) {
        console.warn('Gemini extraction notice:', geminiErr?.message || geminiErr);
      }
    }

    // High-precision structural fallback when text outline is available
    if ((!parsed || !parsed.units || !Array.isArray(parsed.units) || parsed.units.length === 0) && hasText) {
      const structural = parseSyllabusFromText(extractedText, fileName ? fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : undefined);
      if (structural && structural.units && structural.units.length > 0) {
        parsed = structural;
        extractionSource = 'structural-curriculum-parser';
      }
    }

    if (!parsed || (parsed.error && typeof parsed.error === 'string' && parsed.error.trim().length > 0)) {
      return res.status(422).json({
        success: false,
        error: (parsed && parsed.error) ? parsed.error.trim() : 'Could not identify course units or topics. Please verify your document is clear or paste the syllabus text directly.',
      });
    }

    if (!parsed.units || !Array.isArray(parsed.units) || parsed.units.length === 0) {
      return res.status(422).json({
        success: false,
        error: 'Could not identify syllabus units or topics in the provided document. Please ensure the document clearly outlines course chapters, units, or topics.',
      });
    }

    // Ensure subject is clean
    const cleanedSubject = (parsed.subject && typeof parsed.subject === 'string' && parsed.subject.trim().length > 0)
      ? parsed.subject.trim()
      : (fileName ? fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : 'Academic Course Curriculum');

    const totalTopicsCount = parsed.units.reduce((acc: number, u: any) => acc + (Array.isArray(u.topics) ? u.topics.length : 0), 0);
    if (totalTopicsCount === 0) {
      return res.status(422).json({
        success: false,
        error: 'The extracted units contain no topics. Please provide a more detailed syllabus document.',
      });
    }

    // Sanitize and validate every unit and topic with high fidelity
    const cleanedUnits = parsed.units.map((u: any, uIdx: number) => {
      const unitNum = uIdx + 1;
      const unitTitle = u.title && typeof u.title === 'string' && u.title.trim().length > 0
        ? u.title.trim()
        : `Unit ${unitNum}: Core Module`;
      const unitWeight = Math.min(5, Math.max(1, Number(u.weight) || 3));

      const rawTopics = Array.isArray(u.topics) && u.topics.length > 0
        ? u.topics
        : [{ title: `${unitTitle} Principles`, subtopics: ['Foundational Concepts', 'Core Mechanisms', 'Analytical Applications'] }];

      const cleanedTopics = rawTopics.map((t: any, tIdx: number) => {
        const topicNum = tIdx + 1;
        const topicTitle = t.title && typeof t.title === 'string' && t.title.trim().length > 0
          ? t.title.trim()
          : `Topic ${unitNum}.${topicNum}`;

        const subtopics: string[] = Array.isArray(t.subtopics) && t.subtopics.length > 0
          ? t.subtopics.map((s: any) => String(s).trim()).filter((s: string) => s.length > 0)
          : [
              `Foundational concepts of ${topicTitle}`,
              `Core governing mechanisms and principles`,
              `Exam application and problem-solving techniques`,
            ];

        const difficulty = ['easy', 'medium', 'hard'].includes(String(t.difficulty).toLowerCase())
          ? String(t.difficulty).toLowerCase()
          : 'medium';

        const estimatedMins = Math.min(240, Math.max(20, Number(t.estimatedMins) || 60));

        const studyNotes = t.studyNotes && typeof t.studyNotes === 'string' && t.studyNotes.trim().length > 20
          ? t.studyNotes.trim()
          : `• Fundamental Definition: Core principles and rigorous definitions of ${topicTitle}.\n• Governing Mechanism / Formula: Central analytical rules, operational workflows, and formulas.\n• High-Yield Exam Trap: Verify boundary conditions and avoid conflating superficial correlations with mechanistic causation.`;

        const youtubeLinks = Array.isArray(t.youtubeLinks) && t.youtubeLinks.length >= 3
          ? t.youtubeLinks.slice(0, 3).map((v: any, vIdx: number) => ({
              title: v.title || `${topicTitle} - Educational Lecture ${vIdx + 1}`,
              url: v.url && v.url.includes('youtube.com') ? v.url : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${cleanedSubject} ${topicTitle} tutorial`)}`,
              channel: v.channel || 'Khan Academy',
            }))
          : [
              {
                title: `${topicTitle} - Complete Conceptual Tutorial`,
                url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${cleanedSubject} ${topicTitle} tutorial`)}`,
                channel: 'Khan Academy',
              },
              {
                title: `${topicTitle} - High-Yield Review & Applications`,
                url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${cleanedSubject} ${topicTitle} crash course`)}`,
                channel: 'CrashCourse',
              },
              {
                title: `${topicTitle} - Deep Dive Lecture & Problem Solving`,
                url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${cleanedSubject} ${topicTitle} lecture`)}`,
                channel: 'MIT OpenCourseWare',
              },
            ];

        return {
          id: t.id || `t_${unitNum}_${topicNum}`,
          title: topicTitle,
          subtopics,
          difficulty,
          estimatedMins,
          studyNotes,
          youtubeLinks,
        };
      });

      return {
        id: u.id || `u_${unitNum}`,
        title: unitTitle,
        weight: unitWeight,
        topics: cleanedTopics,
      };
    });

    const validatedCurriculum = {
      subject: cleanedSubject,
      description: parsed.description && typeof parsed.description === 'string' && parsed.description.trim().length > 0
        ? parsed.description.trim()
        : `Comprehensive structured curriculum for ${cleanedSubject} covering all core units, key topics, and exam objectives.`,
      totalEstimatedHours: Number(parsed.totalEstimatedHours) || Math.max(20, Math.round(totalTopicsCount * 1.5)),
      units: cleanedUnits,
    };

    return res.json({
      success: true,
      source: extractionSource,
      curriculum: validatedCurriculum,
    });
  } catch (error: any) {
    console.error('Syllabus analysis error:', error);
    return res.status(422).json({
      success: false,
      error: error?.message || 'Unable to extract structured syllabus from document. Please verify the file is legible and contains course topics.',
    });
  }
});

// -------------------------------------------------------------
// 2. Adaptive Quiz Generator API
// -------------------------------------------------------------
app.post('/api/assessment/generate-quiz', async (req: Request, res: Response) => {
  try {
    const {
      subject = 'General Academic',
      unitTitle = '',
      topicTitle = 'Core Concepts',
      subtopics = [],
      studyNotes = '',
      difficulty = 'medium',
      count = 5,
      language = 'en',
    } = req.body;

    if (!ai) {
      return res.json({
        success: true,
        source: 'curated_diagnostic_bank',
        questions: getFallbackQuestions(topicTitle, subject),
      });
    }

    const subtopicsList = Array.isArray(subtopics) && subtopics.length > 0 ? subtopics.join(', ') : 'Key subtopics and mechanisms';

    const prompt = `You are a world-class examination creator and academic psychometrician.
Generate ${count} assessment questions STRICTLY and EXCLUSIVELY based on the following uploaded curriculum topic:

SYLLABUS GROUNDING SPECIFICATION:
- Course Subject: "${subject}"
- Unit: "${unitTitle || 'Active Unit'}"
- Exact Topic: "${topicTitle}"
- Topic Subtopics: "${subtopicsList}"
- Topic Study Notes: "${studyNotes ? studyNotes.slice(0, 1000) : 'Fundamental definitions and core mechanisms'}"
- Difficulty Level: "${difficulty}"
- Target Language: "${language}" (If not English, provide questions in the requested language while keeping technical terminology unambiguous)

STRICT RULES (ZERO CROSS-SUBJECT OR UNRELATED TOPIC TOLERANCE):
1. Every single question, distractor, and explanation MUST be strictly derived from "${topicTitle}" in "${subject}". Never fabricate topics or bring in questions from other subjects or unrelated fields.
2. Questions must be non-repetitive, testing different cognitive dimensions (definition, mechanism, edge-case trap, application).
3. QUESTION FORMAT:
   - For Multiple Choice (mcq):
     - Exactly 4 plausible options labeled "A", "B", "C", "D".
     - Provide "optionItems": [
         { "id": "A", "text": "Option A text..." },
         { "id": "B", "text": "Option B text..." },
         { "id": "C", "text": "Option C text..." },
         { "id": "D", "text": "Option D text..." }
       ]
     - Set "correctOptionId": "A" (or "B", "C", "D")
     - Set "options": ["A) ...", "B) ...", "C) ...", "D) ..."]
     - Set "correctAnswer": Exact text of the correct option
   - For True/False (boolean):
     - Provide "optionItems": [
         { "id": "true", "text": "True" },
         { "id": "false", "text": "False" }
       ]
     - Set "correctOptionId": "true" or "false"
     - Set "options": ["True", "False"]
     - Set "correctAnswer": "True" or "False"
   - For Conceptual Short Answer (short_answer):
     - Provide "correctAnswer": "Complete standard rubric / model answer"
4. MISCONCEPTION ANALYSIS FOR EACH QUESTION:
   - "explanation": Step-by-step conceptual proof why the correct option is true.
   - "commonMisconception": The specific mistaken intuition students fall into for this exact topic.
   - "counterExample": A clear counter-example or test condition that exposes the misconception.
   - "remediationTip": One concise actionable mental rule of thumb.

Return ONLY JSON matching:
{
  "questions": [
    {
      "id": "q1",
      "type": "mcq", // "mcq" | "boolean" | "short_answer"
      "prompt": "Question text strictly about ${topicTitle}...",
      "correctOptionId": "A",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      "optionItems": [
        { "id": "A", "text": "A) Option 1" },
        { "id": "B", "text": "B) Option 2" },
        { "id": "C", "text": "C) Option 3" },
        { "id": "D", "text": "D) Option 4" }
      ],
      "correctAnswer": "A) Option 1",
      "explanation": "Clear conceptual proof...",
      "commonMisconception": "Why students pick distractors...",
      "counterExample": "Memorable reality check...",
      "remediationTip": "Rule of thumb...",
      "bloomTaxonomy": "Apply"
    }
  ]
}`;

    const response = await generateWithFallback({
      primaryModel: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const rawList = Array.isArray(parsed.questions) && parsed.questions.length > 0
      ? parsed.questions
      : getFallbackQuestions(topicTitle, subject);

    // Validate and normalize all questions with strict answer key verification
    // Never silently guess a missing or invalid answer key
    let validQuestions = rawList
      .map((q: any, idx: number) => validateAndNormalizeQuestion(q, idx))
      .filter((q: any) => q.isValidKey && q.prompt.length > 0);

    // If all AI questions lacked valid answer keys, safely fall back to verified curated questions
    if (validQuestions.length === 0) {
      validQuestions = getFallbackQuestions(topicTitle, subject).map((q: any, idx: number) =>
        validateAndNormalizeQuestion(q, idx)
      );
    }

    return res.json({
      success: true,
      source: 'gemini-3.8-flash',
      questions: validQuestions,
    });
  } catch (error: any) {
    console.error('Quiz generation error:', error);
    const fallbackList = getFallbackQuestions(req.body.topicTitle || 'Core Concept', req.body.subject || '')
      .map((q: any, idx: number) => validateAndNormalizeQuestion(q, idx));
    return res.json({
      success: true,
      source: 'curated_diagnostic_bank',
      questions: fallbackList,
    });
  }
});

// -------------------------------------------------------------
// 3. Misconception Detection & Evaluation API
// -------------------------------------------------------------
app.post('/api/assessment/evaluate-answer', async (req: Request, res: Response) => {
  try {
    const {
      questionType = 'mcq',
      selectedOptionId,
      correctOptionId,
      questionPrompt,
      studentAnswer,
      correctAnswer,
      options,
      optionItems,
      explanation,
      counterExample,
      remediationTip,
      commonMisconception,
      topicTitle,
      subject,
    } = req.body;

    // Validate and normalize question schema
    const validatedQ = validateAndNormalizeQuestion({
      type: questionType,
      prompt: questionPrompt,
      options,
      optionItems,
      correctOptionId,
      correctAnswer,
      explanation,
      counterExample,
      remediationTip,
      commonMisconception,
    });

    // 1. Evaluate deterministically against the validated answer key
    const evalResult = gradeQuizAnswer(validatedQ, studentAnswer, selectedOptionId);

    // Missing or invalid answer key -> Never falsely mark an answer correct!
    if (!evalResult.isValidKey) {
      return res.json({
        success: true,
        isCorrect: false,
        errorType: 'invalid_key',
        diagnosis: 'The question answer key is missing or invalid and could not be validated.',
        counterExample: '',
        remediationTip: 'This question has been flagged for missing answer key.',
        correctAnswer: validatedQ.correctAnswer || '(Answer key unavailable)',
      });
    }

    // If answer is correct via validated answer key, return success immediately
    if (evalResult.isCorrect) {
      return res.json({
        success: true,
        isCorrect: true,
        errorType: 'none',
        diagnosis: evalResult.diagnosis,
        counterExample: '',
        remediationTip: 'Keep up the strong retention!',
        correctAnswer: validatedQ.correctAnswer,
      });
    }

    // For short_answer: If not exact normalized match, use semantic evaluation with Gemini if available
    if (questionType === 'short_answer' && ai && studentAnswer && String(studentAnswer).trim().length > 3) {
      try {
        const semanticPrompt = `You are an academic examiner. Perform a semantic evaluation of a student's descriptive short answer against the model rubric.
Topic: "${topicTitle || 'Core Concept'}"
Subject: "${subject || 'Course'}"
Question: "${questionPrompt}"
Expected Model Answer / Rubric: "${validatedQ.correctAnswer}"
Explanation: "${explanation}"
Student's Response: "${studentAnswer}"

Task:
1. Determine whether the student grasped the essential mechanism or conceptual idea ("isCorrect": true), even if expressed in their own words.
2. If incorrect, missing core elements, or off-target, mark "isCorrect": false.
3. Classify into "careless_mistake", "knowledge_gap", or "deep_misconception".

Return JSON:
{
  "isCorrect": boolean,
  "errorType": "none" | "careless_mistake" | "knowledge_gap" | "deep_misconception",
  "diagnosis": "Constructive evaluation of what was accurate and what was missing...",
  "counterExample": "Memorable counter-example if misconception exists...",
  "remediationTip": "Clear takeaway to master this concept..."
}`;
        const response = await generateWithFallback({
          primaryModel: 'gemini-3.8-flash',
          contents: semanticPrompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const parsed = JSON.parse(response.text || '{}');
        if (parsed.isCorrect === true) {
          return res.json({
            success: true,
            isCorrect: true,
            errorType: 'none',
            diagnosis: parsed.diagnosis || `Correct! ${explanation || 'You demonstrated accurate conceptual mastery.'}`,
            counterExample: '',
            remediationTip: 'Keep up the strong retention!',
            correctAnswer: validatedQ.correctAnswer,
          });
        }
      } catch (geminiErr) {
        // Fall through to deterministic evalResult
      }
    }

    // Incorrect answer misconception feedback
    return res.json({
      success: true,
      isCorrect: false,
      errorType: evalResult.errorType,
      diagnosis: evalResult.diagnosis,
      counterExample: counterExample || `Verify the governing boundary conditions and definitions for ${topicTitle || 'this topic'}.`,
      remediationTip: remediationTip || explanation || 'Review the core governing mechanism.',
      correctAnswer: validatedQ.correctAnswer,
      followUpDiagnostic: {
        question: `Which fundamental principle strictly distinguishes ${topicTitle || 'this concept'} from related ideas?`,
        options: ['Boundary constraint validation', 'Conservation of governing properties', 'Directional dependency', 'Superficial correlation'],
        correctOption: 'Boundary constraint validation',
        explanation: `Validating governing constraints is essential to avoid common pitfalls in ${topicTitle || 'this topic'}.`,
      },
    });
  } catch (error: any) {
    console.error('Answer evaluation error:', error);
    return res.json({
      success: true,
      isCorrect: false,
      errorType: 'deep_misconception',
      diagnosis: `Answer evaluation could not be processed.`,
      correctAnswer: String(req.body?.correctAnswer || ''),
    });
  }
});

// -------------------------------------------------------------
// 4. AI Tutor & Chat API (Contextual, Syllabus-Aware & Multilingual)
// -------------------------------------------------------------
app.post('/api/tutor/chat', async (req: Request, res: Response) => {
  try {
    const {
      messages = [],
      activeTopic = '',
      subject = '',
      mode = 'socratic',
      language = 'en',
      stream = false,
    } = req.body;

    const wantsStream = stream === true || req.headers.accept?.includes('text/event-stream');

    // Highly optimized, concise tutor instruction (drastically cuts prompt tokens)
    const modeDirectives =
      mode === 'socratic'
        ? 'Ask 1 scaffolded guiding question with 1 intuitive analogy. Guide rather than lecturing.'
        : mode === 'exam_summary'
        ? 'Give 3-4 high-yield exam bullet points, 1 memory hook, and the #1 exam trap to avoid.'
        : 'Give a crisp first-principles explanation in 2 short paragraphs with 1 concrete real-world example.';

    const systemInstruction = `CogniPulse Tutor (${mode}) for ${subject || 'Course'}: "${activeTopic || 'Active Topic'}".
Instructions:
- ${modeDirectives}
- Keep response concise (under 200 words) and directly address the student's question.
- Use clean Markdown formatting.${language && language !== 'en' ? `\n- Respond in ${language}. Keep technical terms clear.` : ''}`;

    if (!ai) {
      const fallbackReply = `Here is a structured explanation of **${activeTopic || 'this topic'}**:\n\n1. **Core Concept:** Focus on the governing relationship between the input conditions and the resulting output.\n2. **Common Trap:** Beware of confusing initial rates with equilibrium conditions.\n3. **Quick Check:** What is the first invariant you check when solving a problem in ${activeTopic || 'this topic'}?`;
      if (wantsStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ text: fallbackReply })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        return res.end();
      }
      return res.json({ success: true, reply: fallbackReply });
    }

    // Window conversation history: Take only the last 4 non-empty messages to avoid exponential token growth
    const recentMessages = Array.isArray(messages)
      ? messages
          .filter((m: any) => m && m.content && typeof m.content === 'string' && m.content.trim().length > 0)
          .slice(-4)
      : [];

    const conversationPrompt = recentMessages.length > 0
      ? recentMessages.map((m: any) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content.trim()}`).join('\n\n') + '\n\nTutor:'
      : `Student: Can you explain ${activeTopic}?\n\nTutor:`;

    if (wantsStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      try {
        const streamResponse = await generateStreamWithFallback({
          primaryModel: 'gemini-3.8-flash',
          contents: conversationPrompt,
          config: {
            systemInstruction,
          },
        });

        for await (const chunk of streamResponse) {
          const chunkText = chunk.text || '';
          if (chunkText) {
            res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
            (res as any).flush?.();
          }
        }
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        (res as any).flush?.();
        return res.end();
      } catch (streamErr: any) {
        console.error('Tutor stream error:', streamErr);
        res.write(`data: ${JSON.stringify({ error: streamErr?.message || 'Streaming interrupted' })}\n\n`);
        return res.end();
      }
    }

    // Non-streaming fallback path
    const response = await generateWithFallback({
      primaryModel: 'gemini-3.8-flash',
      contents: conversationPrompt,
      config: {
        systemInstruction,
      },
    });

    const reply = response.text || 'Let us explore this concept step by step. What initial condition should we examine first?';
    return res.json({
      success: true,
      reply,
    });
  } catch (error: any) {
    console.error('Tutor chat error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'AI Tutor temporarily unavailable. Please try again.',
      reply: 'Let us break this down step by step: what is the initial condition before this reaction or process begins?',
    });
  }
});

// -------------------------------------------------------------
// 5. Audio Learning Generator API
// -------------------------------------------------------------
app.post('/api/tutor/audio-summary', async (req: Request, res: Response) => {
  try {
    const { topicTitle, subject, mode = 'simplified' } = req.body;

    const prompt = `Create an engaging, highly listenable audio script for a student studying "${topicTitle}" in "${subject}".
Format Mode: "${mode}" (${mode === 'simplified' ? 'conversational podcast explanation like explaining to a smart friend, 90 seconds' : 'rapid high-yield exam blitz summary, essential traps and mnemonics, 60 seconds'}).

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
          hook: `Welcome to your focused audio session on ${topicTitle} in ${subject || 'your course'}. Let's master the core mechanism without confusing jargon.`,
          mechanism: `At its foundation, ${topicTitle} operates on strict governing constraints. Focus on the transformation occurring between the input state and the final equilibrium.`,
          examGold: `On exam day, examiners frequently test edge cases and boundary assumptions for ${topicTitle}. Always verify the baseline assumptions before calculating.`,
          fullScript: `Welcome to your focused audio session on ${topicTitle} in ${subject || 'your course'}. At its foundation, ${topicTitle} operates on strict governing constraints. Focus on the transformation occurring between the input state and the final output. On exam day, examiners frequently test edge cases and boundary assumptions. Always verify baseline constraints before answering!`,
          keyTakeaways: [
            `Identify the fundamental invariants of ${topicTitle}`,
            'Check boundary conditions and edge cases',
            'Verify theoretical output against practical constraints'
          ]
        }
      });
    }

    const response = await generateWithFallback({
      primaryModel: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      audioScript: parsed,
    });
  } catch (error: any) {
    console.error('Audio summary error:', error);
    return res.json({
      success: true,
      audioScript: {
        title: `Audio Session: ${req.body.topicTitle || 'Core Review'}`,
        durationSeconds: 60,
        fullScript: `Welcome to this audio review on ${req.body.topicTitle}. Focus on the core mechanism: identify the inputs, follow the rate-limiting step, and verify the equilibrium state. Keep this in mind when practicing exam problems.`,
        keyTakeaways: ['Identify inputs and outputs', 'Check rate-limiting constraints', 'Verify equilibrium direction'],
      },
    });
  }
});

// -------------------------------------------------------------
// 6. Smart Flashcard Generator API
// -------------------------------------------------------------
app.post('/api/flashcards/generate', async (req: Request, res: Response) => {
  try {
    const { topicTitle, subject, weakPoints = [] } = req.body;

    if (!ai) {
      return res.json({
        success: true,
        flashcards: getFallbackFlashcards(topicTitle || 'Core Concepts', subject || ''),
      });
    }

    const prompt = `Generate 6 smart, high-retention active recall flashcards strictly for "${topicTitle}" in "${subject}".
Include cards targeting these identified student weak points: ${weakPoints.join(', ') || 'Common exam errors'}.
CRITICAL: Do NOT mix questions or flashcards from other subjects. Keep everything 100% focused on "${topicTitle}" in "${subject}".
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

    const response = await generateWithFallback({
      primaryModel: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      flashcards: parsed.flashcards || getFallbackFlashcards(topicTitle, subject),
    });
  } catch (error: any) {
    console.error('Flashcard error:', error);
    return res.json({
      success: true,
      flashcards: getFallbackFlashcards(req.body.topicTitle || 'Active Recall', req.body.subject || ''),
    });
  }
});

// -------------------------------------------------------------
// 7. Exam Rescue Mode Planner API
// -------------------------------------------------------------
app.post('/api/rescue/plan', async (req: Request, res: Response) => {
  try {
    const { examDate, dailyHours = 3, subjects = 'Current Course', topicsStatus, units = [], topics = [] } = req.body;

    const daysUntilExam = Math.max(1, Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    const numericHours = Math.max(1, Math.min(10, Number(dailyHours) || 3));
    const totalAvailableHours = daysUntilExam * numericHours;

    // Extract available topics strictly from syllabus
    let allSyllabusTopics: any[] = [];
    if (Array.isArray(topics) && topics.length > 0) {
      allSyllabusTopics = topics;
    } else if (Array.isArray(units) && units.length > 0) {
      allSyllabusTopics = units.flatMap((u: any) =>
        (u.topics || []).map((t: any) => ({
          id: t.id,
          title: t.title,
          unitTitle: u.title,
          weight: u.weight || 4,
          difficulty: t.difficulty || 'medium',
          status: t.masteryState || 'unfamiliar',
        }))
      );
    } else if (Array.isArray(topicsStatus) && topicsStatus.length > 0) {
      allSyllabusTopics = topicsStatus.map((t: any) => ({
        id: t.id,
        title: t.title || t.topicTitle || 'Core Concept',
        status: t.status || 'unfamiliar',
      }));
    }

    // Identify weak topics for priority scheduling
    const weakTopics = allSyllabusTopics.filter(
      (t: any) => t.status === 'unfamiliar' || t.status === 'unknown' || t.status === 'partial'
    );
    const weakCount = weakTopics.length;
    const estimatedNeededHours = Math.round(weakCount * 1.5 + 4);
    const isOverload = totalAvailableHours < estimatedNeededHours;

    // Fallback schedule with exact syllabus topics
    const fallbackMilestones = generateRescueSchedule(daysUntilExam, numericHours, allSyllabusTopics, subjects);

    if (!ai) {
      return res.json({
        success: true,
        daysUntilExam,
        totalAvailableHours,
        estimatedNeededHours,
        isOverload,
        overloadRatio: totalAvailableHours > 0 ? (estimatedNeededHours / totalAvailableHours).toFixed(2) : '1.5',
        strategyTitle: isOverload ? 'Aggressive High-Yield Triage' : 'Balanced Full-Mastery Plan',
        strategicVerdict: isOverload
          ? 'Capacity Alert: Daily study runway is tighter than required for comprehensive coverage. Triaging 80% of remaining time to highest-weight weak topics.'
          : 'You have a healthy runway to systematically master remaining concepts without cramming.',
        triageRecommendations: [
          'Concentrate primary morning blocks on high-weight unfamiliar topics',
          'Run a 15-minute spaced-repetition session for active recall',
          'Target error remediation in the Misconception Clinic immediately after quizzes',
        ],
        dailyMilestones: fallbackMilestones,
      });
    }

    const topicCatalogString = allSyllabusTopics
      .map((t: any, idx: number) => `${idx + 1}. ${t.title} [Unit: ${t.unitTitle || 'Active Unit'}, Weight: ${t.weight || 3}, Status: ${t.status || 'unfamiliar'}]`)
      .join('\n');

    const prompt = `You are CogniPulse Exam Rescue Agent.
A student is preparing for an exam in "${subjects}".

EXAM PARAMETERS:
- Days Remaining Until Exam: ${daysUntilExam}
- Available Daily Study Time: ${numericHours} hours/day
- Total Study Runway: ${totalAvailableHours} hours
- Unmastered / Weak Topics Count: ${weakCount} of ${allSyllabusTopics.length} total topics
- Estimated Hours Needed for Thorough Coverage: ${estimatedNeededHours} hours
- Workload Overloaded?: ${isOverload ? 'YES (Aggressive triage required)' : 'NO (Paced balanced schedule)'}

STUDENT'S EXACT SYLLABUS TOPICS (STRICT SELECTION POOL):
${topicCatalogString || `1. ${subjects} Core Principles\n2. Analytical Problem Solving`}

STRICT REALISM & NON-REPETITION RULES:
1. STRICT GROUNDING: Every task in every day's timetable MUST reference an EXACT topic title from the list above. Do NOT invent, hallucinate, or fabricate any new or generic topic names like "Course High-Yield Review".
2. REALISTIC TIME SLOTS: For each day (up to ${Math.min(daysUntilExam, 7)} days), create realistic clock-time study slots totaling exactly ~${numericHours} hours (e.g. for 3 hours: "09:00 - 10:15", "10:30 - 11:45", "16:00 - 16:30").
3. NON-REPETITIVE TASKS: Every single task must have a distinct, concrete, actionable directive specific to that topic (e.g. "Work through 6 textbook application problems on [Topic] checking boundary constraints", "Analyze core formula derivation and state equations for [Topic]", "Targeted active recall flashcard drill on [Topic] edge cases"). NEVER repeat identical phrases or actions across days.
4. TASK STRUCTURE: Each day's "tasks" array must contain 2-4 items with:
   - "timeSlot": clock string like "09:00 - 10:15"
   - "durationMins": integer minutes (e.g. 75)
   - "topic": exact topic name from the list above
   - "task": specific actionable study instruction

Return ONLY JSON matching:
{
  "strategyTitle": "Strategy title...",
  "strategicVerdict": "Direct 2-sentence reality check...",
  "triageRecommendations": ["Actionable recommendation 1", "Actionable recommendation 2", "Actionable recommendation 3"],
  "dailyMilestones": [
    {
      "day": 1,
      "dateLabel": "Day 1 (Urgent Focus)",
      "targetHours": ${numericHours},
      "focus": "Exact Topic Name",
      "priority": "Critical", // "Critical" | "High" | "Medium"
      "actions": ["Summary line 1", "Summary line 2"],
      "tasks": [
        {
          "timeSlot": "09:00 - 10:15",
          "durationMins": 75,
          "topic": "Exact Topic Name",
          "task": "Specific actionable study directive..."
        }
      ]
    }
  ]
}`;

    const response = await generateWithFallback({
      primaryModel: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const milestones = Array.isArray(parsed.dailyMilestones) && parsed.dailyMilestones.length > 0
      ? parsed.dailyMilestones
      : fallbackMilestones;

    // Validate and guarantee tasks on each milestone
    const verifiedMilestones = milestones.map((m: any, mIdx: number) => {
      const dayNum = m.day || mIdx + 1;
      const fallbackForDay = fallbackMilestones[mIdx] || fallbackMilestones[0];
      const validTasks = Array.isArray(m.tasks) && m.tasks.length > 0
        ? m.tasks.map((tsk: any) => ({
            timeSlot: tsk.timeSlot || '09:00 - 10:15',
            durationMins: Number(tsk.durationMins) || 60,
            topic: tsk.topic || m.focus || (allSyllabusTopics[0]?.title || subjects),
            task: tsk.task || 'Concept mastery and problem solving',
          }))
        : fallbackForDay.tasks;

      return {
        day: dayNum,
        dateLabel: m.dateLabel || `Day ${dayNum}`,
        targetHours: Number(m.targetHours) || numericHours,
        focus: m.focus || validTasks[0]?.topic || subjects,
        priority: m.priority || (mIdx < 2 ? 'Critical' : 'High'),
        actions: Array.isArray(m.actions) && m.actions.length > 0 ? m.actions : fallbackForDay.actions,
        tasks: validTasks,
      };
    });

    return res.json({
      success: true,
      daysUntilExam,
      totalAvailableHours,
      estimatedNeededHours,
      isOverload,
      strategyTitle: parsed.strategyTitle || (isOverload ? 'Aggressive High-Yield Triage' : 'Targeted Systematic Mastery'),
      strategicVerdict: parsed.strategicVerdict || (isOverload
        ? 'Runway is concentrated. Deferring low-weight items to guarantee mastery of high-impact exam concepts.'
        : 'Sufficient runway available. Commit to consistent daily blocks to build retention.'),
      triageRecommendations: Array.isArray(parsed.triageRecommendations) && parsed.triageRecommendations.length > 0
        ? parsed.triageRecommendations
        : [
            'Triage study blocks to weak topics first',
            'Conduct daily 15-minute spaced active recall card reviews',
            'Take an adaptive quiz after each session to calibrate mastery',
          ],
      dailyMilestones: verifiedMilestones,
    });
  } catch (error: any) {
    console.error('Rescue plan error:', error);
    const days = Math.max(1, Math.min(7, Math.ceil((new Date(req.body.examDate || '').getTime() - Date.now()) / (1000 * 60 * 60 * 24)) || 7));
    const hours = Number(req.body.dailyHours) || 3;
    const fallbackList = Array.isArray(req.body.topics) ? req.body.topics : [];
    return res.json({
      success: true,
      daysUntilExam: days,
      totalAvailableHours: days * hours,
      estimatedNeededHours: Math.round(fallbackList.length * 1.5 + 4),
      isOverload: false,
      strategyTitle: 'Targeted High-Yield Rescue Plan',
      strategicVerdict: 'You have adequate study time if you commit to focused daily blocks without multitasking.',
      triageRecommendations: [
        'Focus on unmastered high-weight syllabus units first',
        'Spend 15 minutes each morning on active recall flashcards',
        'Verify retention via topic adaptive quizzes',
      ],
      dailyMilestones: generateRescueSchedule(days, hours, fallbackList, req.body.subjects || ''),
    });
  }
});

// Helper functions for fallbacks with strict subject isolation
function detectSubjectCategory(topicTitle: string, subjectName: string): 'cs' | 'physics' | 'chemistry' | 'math' | 'biology' | 'general' {
  const combined = `${subjectName} ${topicTitle}`.toLowerCase();
  if (
    combined.includes('computer') ||
    combined.includes('algorithm') ||
    combined.includes('data structure') ||
    combined.includes('programming') ||
    combined.includes('software') ||
    combined.includes('coding') ||
    combined.includes('big-o') ||
    combined.includes('binary search') ||
    combined.includes('graph') ||
    combined.includes('tree') ||
    combined.includes('stack') ||
    combined.includes('queue') ||
    combined.includes('dynamic programming') ||
    combined.includes('recursion') ||
    combined.includes('python') ||
    combined.includes('java') ||
    combined.includes('c++')
  ) {
    return 'cs';
  }
  if (
    combined.includes('physic') ||
    combined.includes('mechanic') ||
    combined.includes('kinematic') ||
    combined.includes('electromagnet') ||
    combined.includes('thermodynamic') ||
    combined.includes('optics') ||
    combined.includes('gravity') ||
    combined.includes('newton') ||
    combined.includes('wave')
  ) {
    return 'physics';
  }
  if (
    combined.includes('chemist') ||
    combined.includes('reaction') ||
    combined.includes('equilibrium') ||
    combined.includes('acid') ||
    combined.includes('base') ||
    combined.includes('stoichiometry') ||
    combined.includes('organic chemistry') ||
    combined.includes('molar')
  ) {
    return 'chemistry';
  }
  if (
    combined.includes('math') ||
    combined.includes('calculus') ||
    combined.includes('algebra') ||
    combined.includes('derivative') ||
    combined.includes('integral') ||
    combined.includes('geometry') ||
    combined.includes('statistic') ||
    combined.includes('probability')
  ) {
    return 'math';
  }
  if (
    combined.includes('bio') ||
    combined.includes('cell') ||
    combined.includes('genetics') ||
    combined.includes('enzyme') ||
    combined.includes('dna') ||
    combined.includes('rna') ||
    combined.includes('respiration') ||
    combined.includes('photosynthesis') ||
    combined.includes('protein') ||
    combined.includes('ecology')
  ) {
    return 'biology';
  }
  return 'general';
}

function getFallbackQuestions(topic: string, subject: string = '') {
  const category = detectSubjectCategory(topic, subject);

  if (category === 'cs') {
    return [
      {
        id: 'q_cs_1',
        type: 'mcq',
        prompt: `In the analysis of ${topic}, how does the worst-case lookup time of a balanced Binary Search Tree (AVL / Red-Black) compare to an unsorted array of size N?`,
        options: [
          'A) Balanced BST is O(log N); unsorted array is O(N)',
          'B) Balanced BST is O(1); unsorted array is O(log N)',
          'C) Both structures provide O(1) random access',
          'D) Balanced BST is O(N); unsorted array is O(1)',
        ],
        correctAnswer: 'A) Balanced BST is O(log N); unsorted array is O(N)',
        explanation: 'A balanced BST halves the search space at each branch comparison, giving guaranteed O(log N) depth. Searching an unsorted array requires scanning elements linearly up to O(N).',
        commonMisconception: 'Assuming any tree structure offers O(1) direct indexing like a hash table.',
        bloomTaxonomy: 'Understand',
      },
      {
        id: 'q_cs_2',
        type: 'mcq',
        prompt: 'What is the amortized insertion time complexity for a dynamic array (like std::vector or ArrayList) when capacity doubling is used?',
        options: [
          'A) O(1) amortized per insertion',
          'B) O(N) amortized per insertion',
          'C) O(log N) amortized per insertion',
          'D) O(N^2) amortized per insertion',
        ],
        correctAnswer: 'A) O(1) amortized per insertion',
        explanation: 'Although doubling the array takes O(N) when resizing occurs, this expensive operation happens exponentially infrequently, yielding an aggregate average of O(1) work per insertion.',
        commonMisconception: 'Conflating the worst-case single reallocation spike with the amortized cost across the sequence.',
        bloomTaxonomy: 'Analyze',
      },
      {
        id: 'q_cs_3',
        type: 'boolean',
        prompt: 'True or False: In unweighted graphs, Breadth-First Search (BFS) is guaranteed to find the shortest path in terms of edge count from the start node.',
        options: ['True', 'False'],
        correctAnswer: 'True',
        explanation: 'BFS explores vertices in order of increasing distance from the starting vertex using a FIFO queue, ensuring that the first time a target vertex is reached, the path has minimal edges.',
        commonMisconception: 'Believing DFS and BFS find identical paths in unweighted graphs.',
        bloomTaxonomy: 'Apply',
      },
      {
        id: 'q_cs_4',
        type: 'mcq',
        prompt: 'Why does standard Quicksort experience worst-case O(N^2) time complexity, and how is it mitigated?',
        options: [
          'A) It degenerates when the chosen pivot consistently splits into partitions of 0 and N-1; randomized or median-of-three pivot selection prevents this',
          'B) It degenerates due to recursive stack overflow; replacing recursion with a while-loop fixes it',
          'C) It degenerates only when elements are in random order; sorting beforehand prevents it',
          'D) It is caused by cache thrashing; increasing array size solves it',
        ],
        correctAnswer: 'A) It degenerates when the chosen pivot consistently splits into partitions of 0 and N-1; randomized or median-of-three pivot selection prevents this',
        explanation: 'Extreme imbalances produce N recursive calls of size N-1, giving sum(i=1..N) = O(N^2). Randomized pivot selection ensures balanced splits on average.',
        commonMisconception: 'Thinking quicksort is always O(N log N) regardless of pivot selection.',
        bloomTaxonomy: 'Evaluate',
      },
      {
        id: 'q_cs_5',
        type: 'short_answer',
        prompt: `Explain the fundamental difference between memoization (top-down) and tabulation (bottom-up) in dynamic programming for ${topic}.`,
        correctAnswer: 'Memoization solves recursively from the top goal down while caching results; tabulation solves base subproblems iteratively from the bottom up in a table.',
        explanation: 'Both avoid recomputing overlapping subproblems, but memoization relies on recursive call stacks whereas tabulation is iterative and avoids recursion overhead.',
        commonMisconception: 'Assuming dynamic programming must always be implemented with recursive functions.',
        bloomTaxonomy: 'Analyze',
      },
    ];
  }

  if (category === 'physics') {
    return [
      {
        id: 'q_phy_1',
        type: 'mcq',
        prompt: `In the study of ${topic}, what happens to total mechanical energy in an isolated system where only conservative forces do work?`,
        options: [
          'A) Total mechanical energy is strictly conserved and remains constant',
          'B) Total mechanical energy decreases continuously due to entropy',
          'C) Kinetic energy is destroyed while potential energy increases',
          'D) Total energy fluctuates with temperature',
        ],
        correctAnswer: 'A) Total mechanical energy is strictly conserved and remains constant',
        explanation: 'In the absence of non-conservative forces like friction, kinetic and potential energy convert into each other while their sum remains invariant.',
        commonMisconception: 'Believing kinetic energy must always degrade even in frictionless ideal systems.',
        bloomTaxonomy: 'Understand',
      },
      {
        id: 'q_phy_2',
        type: 'boolean',
        prompt: 'True or False: At the exact peak apex of a vertical projectile trajectory, the acceleration of the object is zero.',
        options: ['True', 'False'],
        correctAnswer: 'False',
        explanation: 'At the apex, vertical velocity is momentarily zero, but gravitational acceleration continues acting downwards at 9.8 m/s^2 continuously.',
        commonMisconception: 'Confusing zero instantaneous velocity with zero acceleration.',
        bloomTaxonomy: 'Analyze',
      },
      {
        id: 'q_phy_3',
        type: 'mcq',
        prompt: 'An object moves in a circle of radius R at constant speed v. What is its acceleration?',
        options: [
          'A) Zero, because speed is constant',
          'B) v^2 / R directed toward the center of the circle',
          'C) v^2 / R directed tangent to the velocity vector',
          'D) v * R directed outward away from center',
        ],
        correctAnswer: 'B) v^2 / R directed toward the center of the circle',
        explanation: 'Even though speed is scalar and constant, the direction of velocity changes continuously, requiring a centripetal acceleration vector pointed radially inward.',
        commonMisconception: 'Thinking zero change in speed implies zero acceleration.',
        bloomTaxonomy: 'Apply',
      },
      {
        id: 'q_phy_4',
        type: 'mcq',
        prompt: 'According to the Second Law of Thermodynamics, what happens to the entropy of an isolated system undergoing a spontaneous process?',
        options: [
          'A) It always increases or remains constant (delta S >= 0)',
          'B) It decreases to minimize potential energy',
          'C) It always equals zero at thermodynamic equilibrium',
          'D) It oscillates periodically',
        ],
        correctAnswer: 'A) It always increases or remains constant (delta S >= 0)',
        explanation: 'Spontaneous transformations in isolated systems evolve toward macrostates with higher statistical multiplicity.',
        commonMisconception: 'Assuming entropy can spontaneously decrease in isolated systems without work input.',
        bloomTaxonomy: 'Understand',
      },
      {
        id: 'q_phy_5',
        type: 'short_answer',
        prompt: `State how Newton's Third Law applies to the gravitational interaction between the Earth and the Moon.`,
        correctAnswer: 'The Earth exerts a gravitational force on the Moon equal in magnitude and opposite in direction to the force the Moon exerts on the Earth.',
        explanation: 'Forces always occur in matched action-reaction pairs between two interacting bodies regardless of their mass disparity.',
        commonMisconception: 'Thinking the more massive Earth exerts a stronger gravitational force than the Moon exerts back.',
        bloomTaxonomy: 'Apply',
      },
    ];
  }

  if (category === 'chemistry') {
    return [
      {
        id: 'q_chem_1',
        type: 'mcq',
        prompt: `For an exothermic reversible gas-phase reaction at equilibrium in ${topic}, how does increasing temperature affect the equilibrium constant (Keq)?`,
        options: [
          'A) Keq decreases, shifting equilibrium toward reactants',
          'B) Keq increases, shifting equilibrium toward products',
          'C) Keq remains unchanged; only reaction rate increases',
          'D) Equilibrium shifts toward the side with fewer gas moles',
        ],
        correctAnswer: 'A) Keq decreases, shifting equilibrium toward reactants',
        explanation: 'Heat acts as a product in an exothermic reaction. Adding thermal energy shifts the reaction in the reverse direction according to Le Chatelier, lowering Keq.',
        commonMisconception: 'Assuming catalysts or temperature shifts never alter Keq.',
        bloomTaxonomy: 'Apply',
      },
      {
        id: 'q_chem_2',
        type: 'boolean',
        prompt: 'True or False: Adding a catalyst to a chemical reaction lowers activation energy but does not alter the equilibrium constant (Keq).',
        options: ['True', 'False'],
        correctAnswer: 'True',
        explanation: 'Catalysts accelerate both forward and reverse reaction rates by the exact same proportion, leaving the thermodynamic equilibrium ratio unchanged.',
        commonMisconception: 'Believing catalysts increase final product yield at equilibrium.',
        bloomTaxonomy: 'Understand',
      },
      {
        id: 'q_chem_3',
        type: 'mcq',
        prompt: 'Why is the second ionization energy of sodium (Na) dramatically higher than its first ionization energy?',
        options: [
          'A) The second electron is removed from a stable noble-gas closed shell (2p6) closer to the nucleus',
          'B) Sodium forms a covalent dimer upon ionization',
          'C) The nuclear charge drops after first ionization',
          'D) Electronegativity of Na increases beyond chlorine',
        ],
        correctAnswer: 'A) The second electron is removed from a stable noble-gas closed shell (2p6) closer to the nucleus',
        explanation: 'First ionization removes the single 3s1 valence electron. Removing the second requires breaking the stable octet of the core shell with much higher effective nuclear charge.',
        commonMisconception: 'Believing all ionization energies increase in equal linear increments.',
        bloomTaxonomy: 'Analyze',
      },
      {
        id: 'q_chem_4',
        type: 'mcq',
        prompt: 'Which combination produces an effective chemical buffer solution?',
        options: [
          'A) A weak acid and its conjugate base salt',
          'B) A strong acid mixed with a strong base in equal molarity',
          'C) A pure strong acid dissolved in water',
          'D) Two inert salts dissolved in alcohol',
        ],
        correctAnswer: 'A) A weak acid and its conjugate base salt',
        explanation: 'A buffer requires a conjugate pair reservoir able to neutralize both added hydronium and hydroxide ions without significant pH swing.',
        commonMisconception: 'Confusing a neutralized salt solution with a buffering system.',
        bloomTaxonomy: 'Understand',
      },
      {
        id: 'q_chem_5',
        type: 'short_answer',
        prompt: `Explain how Le Chatelier's Principle predicts the response of a gaseous equilibrium system when volume is halved.`,
        correctAnswer: 'Halving volume doubles pressure; the system shifts toward the side of the balanced equation with fewer total moles of gas to relieve pressure.',
        explanation: 'The system responds to counter the imposed stress by reducing total gas particle density.',
        commonMisconception: 'Assuming pressure changes have no directional impact on gas reactions with unequal moles.',
        bloomTaxonomy: 'Apply',
      },
    ];
  }

  if (category === 'math') {
    return [
      {
        id: 'q_math_1',
        type: 'mcq',
        prompt: `In differential calculus for ${topic}, what is the derivative of f(x) = ln(3x^2 + 1) with respect to x?`,
        options: [
          'A) 6x / (3x^2 + 1)',
          'B) 1 / (3x^2 + 1)',
          'C) 6x * ln(3x^2 + 1)',
          'D) 3 / (6x)',
        ],
        correctAnswer: 'A) 6x / (3x^2 + 1)',
        explanation: 'By the chain rule, d/dx[ln(u)] = u\'/u. Here u = 3x^2 + 1 and u\' = 6x, yielding 6x / (3x^2 + 1).',
        commonMisconception: 'Forgetting to apply the inner chain rule derivative.',
        bloomTaxonomy: 'Apply',
      },
      {
        id: 'q_math_2',
        type: 'boolean',
        prompt: 'True or False: If a function f(x) is continuous at x = a, it is guaranteed to be differentiable at x = a.',
        options: ['True', 'False'],
        correctAnswer: 'False',
        explanation: 'Continuity is a necessary condition for differentiability, but not sufficient. A sharp corner or cusp (such as f(x) = |x| at x = 0) is continuous but not differentiable.',
        commonMisconception: 'Assuming continuity implies differentiability.',
        bloomTaxonomy: 'Understand',
      },
      {
        id: 'q_math_3',
        type: 'mcq',
        prompt: 'What does a matrix determinant equal to 0 (det(A) = 0) indicate about the square matrix A?',
        options: [
          'A) The matrix is non-invertible (singular) and its columns are linearly dependent',
          'B) The matrix is guaranteed to be identity',
          'C) The linear system Ax = b has exactly one unique solution',
          'D) All eigenvalues must be strictly positive',
        ],
        correctAnswer: 'A) The matrix is non-invertible (singular) and its columns are linearly dependent',
        explanation: 'A zero determinant indicates zero volume scaling, non-trivial null space, and lack of multiplicative inverse.',
        commonMisconception: 'Thinking det(A) = 0 means the entire matrix contains only zeros.',
        bloomTaxonomy: 'Analyze',
      },
      {
        id: 'q_math_4',
        type: 'mcq',
        prompt: 'If two events A and B are independent with P(A) = 0.4 and P(B) = 0.5, what is P(A and B)?',
        options: [
          'A) 0.20',
          'B) 0.90',
          'C) 0.10',
          'D) 0.45',
        ],
        correctAnswer: 'A) 0.20',
        explanation: 'For independent events, the joint probability is the product: P(A and B) = P(A) * P(B) = 0.4 * 0.5 = 0.20.',
        commonMisconception: 'Adding probabilities instead of multiplying for independent joint occurrences.',
        bloomTaxonomy: 'Apply',
      },
      {
        id: 'q_math_5',
        type: 'short_answer',
        prompt: `State the Fundamental Theorem of Calculus relating integration and differentiation.`,
        correctAnswer: 'If F is an antiderivative of continuous f on [a, b], then the definite integral of f from a to b equals F(b) - F(a).',
        explanation: 'It establishes differentiation and integration as inverse processes of one another.',
        commonMisconception: 'Viewing definite integrals purely as static geometric areas without connection to rates of change.',
        bloomTaxonomy: 'Understand',
      },
    ];
  }

  if (category === 'biology') {
    return [
      {
        id: 'q_bio_1',
        type: 'mcq',
        prompt: `In the study of ${topic}, how does increasing enzyme substrate concentration affect reaction rate when the enzyme is already saturated?`,
        options: [
          'A) The reaction rate stays constant at Vmax',
          'B) The reaction rate increases exponentially',
          'C) The reaction stops due to feedback inhibition',
          'D) The reaction reverses direction',
        ],
        correctAnswer: 'A) The reaction rate stays constant at Vmax',
        explanation: 'Once all active sites are bound (saturation), adding more substrate cannot increase the reaction velocity because enzyme turnover rate becomes the limiting constraint.',
        commonMisconception: 'Students often assume more reactants always produce a faster rate, neglecting saturation constraints.',
        bloomTaxonomy: 'Apply',
      },
      {
        id: 'q_bio_2',
        type: 'mcq',
        prompt: 'Which statement correctly distinguishes active transport from facilitated diffusion across a cellular membrane?',
        options: [
          'A) Active transport moves solutes against their electrochemical gradient and requires metabolic energy (ATP)',
          'B) Facilitated diffusion moves solutes against their concentration gradient using ATP',
          'C) Active transport does not utilize membrane transport proteins',
          'D) Both processes flow passively from high to low concentration',
        ],
        correctAnswer: 'A) Active transport moves solutes against their electrochemical gradient and requires metabolic energy (ATP)',
        explanation: 'Active transport requires ATP hydrolysis or ion coupling to pump substances uphill against entropy.',
        commonMisconception: 'Confusing protein-assisted transport with active energy requirement.',
        bloomTaxonomy: 'Understand',
      },
      {
        id: 'q_bio_3',
        type: 'boolean',
        prompt: 'True or False: Denaturation of a protein usually disrupts secondary and tertiary structures but leaves the primary polypeptide backbone intact.',
        options: ['True', 'False'],
        correctAnswer: 'True',
        explanation: 'Denaturation breaks non-covalent hydrogen and disulfide bonds in secondary, tertiary, and quaternary conformations, but leaves covalent peptide backbone bonds in the primary sequence intact.',
        commonMisconception: 'Thinking denaturation completely hydrolyzes the covalent peptide bonds.',
        bloomTaxonomy: 'Analyze',
      },
      {
        id: 'q_bio_4',
        type: 'mcq',
        prompt: 'During aerobic cellular respiration, where is the highest concentration of protons (H+) accumulated to drive ATP synthase?',
        options: [
          'A) In the mitochondrial intermembrane space',
          'B) In the mitochondrial matrix',
          'C) In the outer mitochondrial membrane',
          'D) In the cytosol',
        ],
        correctAnswer: 'A) In the mitochondrial intermembrane space',
        explanation: 'Electron transport complexes pump protons from the matrix into the intermembrane space, building the chemiosmotic electrochemical gradient.',
        commonMisconception: 'Assuming protons are pumped into the matrix rather than out of it.',
        bloomTaxonomy: 'Understand',
      },
      {
        id: 'q_bio_5',
        type: 'short_answer',
        prompt: 'Explain what happens to an animal red blood cell when placed in a hypotonic saline solution, and state the underlying physical principle.',
        correctAnswer: 'Water moves into the cell via osmosis down its water potential gradient, causing the cell to swell and potentially lyse (burst).',
        explanation: 'A hypotonic environment has higher water potential (lower solute concentration) than the cytoplasm, inducing net inward osmotic flux.',
        commonMisconception: 'Thinking solutes leave the cell rather than water entering it.',
        bloomTaxonomy: 'Apply',
      },
    ];
  }

  // General fallback strictly grounded in the given subject and topic
  return [
    {
      id: 'q_gen_1',
      type: 'mcq',
      prompt: `In the study of ${subject || 'this course'}, what is the primary governing principle of "${topic}"?`,
      options: [
        `A) It defines the baseline rules and constraints governing ${topic}`,
        `B) It contradicts the core axioms of ${subject || 'this field'}`,
        `C) It only applies when external observation is absent`,
        `D) It operates without boundary conditions`,
      ],
      correctAnswer: `A) It defines the baseline rules and constraints governing ${topic}`,
      explanation: `Mastering ${topic} requires establishing its primary governing constraints and predictable operational rules within ${subject || 'the discipline'}.`,
      commonMisconception: `Assuming ${topic} can be understood without its underlying foundational constraints.`,
      bloomTaxonomy: 'Understand',
    },
    {
      id: 'q_gen_2',
      type: 'boolean',
      prompt: `True or False: In ${subject || 'this field'}, the core principles of "${topic}" apply consistently across standard boundary conditions.`,
      options: ['True', 'False'],
      correctAnswer: 'True',
      explanation: `Foundational mechanisms in ${topic} maintain invariant properties within standard domain bounds.`,
      commonMisconception: `Assuming rules change arbitrarily without shifting boundary parameters.`,
      bloomTaxonomy: 'Analyze',
    },
    {
      id: 'q_gen_3',
      type: 'mcq',
      prompt: `When analyzing a practical problem involving "${topic}", what is the most common diagnostic error students make?`,
      options: [
        'A) Neglecting initial boundary conditions and jumping to premature conclusions',
        'B) Following the theoretical framework too rigorously',
        'C) Verifying empirical data against known constants',
        'D) Using standard unit definitions',
      ],
      correctAnswer: 'A) Neglecting initial boundary conditions and jumping to premature conclusions',
      explanation: 'Systematic errors in assessments almost always stem from overlooked initial conditions or unstated assumptions.',
      commonMisconception: 'Treating problem statements as simple formulas rather than structured systems.',
      bloomTaxonomy: 'Evaluate',
    },
    {
      id: 'q_gen_4',
      type: 'mcq',
      prompt: `How does "${topic}" integrate with higher-level concepts in ${subject || 'this discipline'}?`,
      options: [
        'A) It acts as a foundational building block for advanced analysis',
        'B) It operates completely isolated from all other units',
        'C) It is only an empirical anomaly with no theoretical basis',
        'D) It is an outdated framework replaced by modern heuristics',
      ],
      correctAnswer: 'A) It acts as a foundational building block for advanced analysis',
      explanation: `A thorough comprehension of ${topic} is essential for tackling multi-topic synthesis questions on examinations.`,
      commonMisconception: 'Studying topics as disconnected silos rather than an integrated framework.',
      bloomTaxonomy: 'Understand',
    },
    {
      id: 'q_gen_5',
      type: 'short_answer',
      prompt: `State the primary objective of analyzing "${topic}" when preparing for exam-level problem solving in ${subject || 'this course'}.`,
      correctAnswer: `To master the governing rules, identify key variables, and apply systematic reasoning to reach validated solutions.`,
      explanation: `Exam success in ${subject || 'this subject'} relies on applying core principles under time constraints.`,
      commonMisconception: 'Memorizing superficial steps rather than understanding the underlying mechanism.',
      bloomTaxonomy: 'Apply',
    },
  ];
}

function getFallbackFlashcards(topic: string, subject: string = '') {
  const category = detectSubjectCategory(topic, subject);

  if (category === 'cs') {
    return [
      {
        id: 'fc_1',
        front: `What is the difference between Big-O and Big-Omega in ${topic}?`,
        back: 'Big-O describes an asymptotic upper bound (worst-case growth rate), whereas Big-Omega describes an asymptotic lower bound (best-case floor).',
        hint: 'Upper ceiling vs lower floor.',
        topic,
      },
      {
        id: 'fc_2',
        front: 'Why do contiguous arrays provide faster sequential iteration than linked lists?',
        back: 'Arrays store elements in contiguous memory addresses, leveraging CPU L1/L2 cache locality and spatial prefetching, whereas linked list nodes are scattered across the heap with pointer chasing.',
        hint: 'Think CPU hardware cache lines, not just algorithmic Big-O.',
        topic,
      },
      {
        id: 'fc_3',
        front: 'What invariant must a Binary Search Tree (BST) satisfy?',
        back: 'For every node: all keys in its left subtree must be strictly less than the node key, and all keys in its right subtree must be strictly greater.',
        hint: 'Left < Root < Right.',
        topic,
      },
      {
        id: 'fc_4',
        front: 'Common Exam Pitfall: Does dynamic programming tabulation require recursion?',
        back: 'No! Tabulation is strictly iterative (bottom-up), filling a table from base cases up to avoid recursion call-stack overhead.',
        hint: 'Bottom-up vs top-down.',
        topic,
      },
    ];
  }

  if (category === 'physics') {
    return [
      {
        id: 'fc_1',
        front: `What condition is required for total mechanical energy to be conserved in ${topic}?`,
        back: 'No work is done by non-conservative forces (such as friction or air resistance). Internal conservative forces simply convert kinetic into potential energy.',
        hint: 'Friction and dissipative forces must be absent.',
        topic,
      },
      {
        id: 'fc_2',
        front: 'Why is acceleration NOT zero at the apex of a projectile trajectory?',
        back: 'Even though instantaneous vertical velocity is 0 m/s, the gravitational field continues applying a downward force (F = mg), producing a constant acceleration g.',
        hint: 'Velocity is zero; net force is not.',
        topic,
      },
      {
        id: 'fc_3',
        front: 'How does centripetal force relate to the velocity of an object in uniform circular motion?',
        back: 'F_c = m * (v^2 / r). The force acts perpendicularly to the velocity vector toward the center, changing direction without changing speed.',
        hint: 'Perpendicular inward force.',
        topic,
      },
      {
        id: 'fc_4',
        front: 'What does the First Law of Thermodynamics state?',
        back: 'Delta U = Q - W (Internal energy change equals heat added to system minus work done by system; energy cannot be created or destroyed).',
        hint: 'Conservation of energy across heat and work.',
        topic,
      },
    ];
  }

  if (category === 'chemistry') {
    return [
      {
        id: 'fc_1',
        front: `How does a catalyst affect activation energy (Ea) and equilibrium constant (Keq) in ${topic}?`,
        back: 'A catalyst lowers the activation energy for both forward and reverse paths equally, accelerating the approach to equilibrium without altering the equilibrium constant Keq.',
        hint: 'Ea changes, Keq does NOT.',
        topic,
      },
      {
        id: 'fc_2',
        front: 'What is Le Chatelier\'s Principle for endothermic reactions when heated?',
        back: 'Increasing temperature adds heat (a reactant in endothermic processes), shifting equilibrium toward products and increasing Keq.',
        hint: 'Treat heat as a reactant.',
        topic,
      },
      {
        id: 'fc_3',
        front: 'What defines a conjugate acid-base pair under Bronsted-Lowry theory?',
        back: 'Two chemical species that differ by exactly one transferable proton (H+). The acid donates the proton to become the conjugate base.',
        hint: 'Single proton difference.',
        topic,
      },
      {
        id: 'fc_4',
        front: 'Why does atomic radius decrease as you move left to right across a period in the periodic table?',
        back: 'Electrons are added to the same principal energy shell while nuclear charge (number of protons) increases, pulling the electron cloud closer.',
        hint: 'Increasing effective nuclear charge with constant shielding.',
        topic,
      },
    ];
  }

  // Biology fallback
  if (category === 'biology') {
    return [
      {
        id: 'fc_1',
        front: `What is the thermodynamic driving force behind osmosis in ${topic}?`,
        back: 'The difference in chemical water potential moving from regions of higher free water concentration to lower free water concentration across a semi-permeable boundary.',
        hint: 'Think free energy and entropy, not solute pull.',
        topic,
      },
      {
        id: 'fc_2',
        front: 'How do competitive and non-competitive enzyme inhibitors differ regarding Vmax and Km?',
        back: 'Competitive inhibitors increase apparent Km but leave Vmax unchanged (overcome with excess substrate). Non-competitive inhibitors decrease Vmax while keeping Km unchanged.',
        hint: 'Can high substrate concentration overwhelm the inhibitor?',
        topic,
      },
      {
        id: 'fc_3',
        front: 'What constitutes the quaternary structure of a functional protein?',
        back: 'The spatial arrangement and non-covalent interaction of two or more independent polypeptide subunit chains (e.g. hemoglobin tetramer).',
        hint: 'More than one polypeptide chain involved.',
        topic,
      },
      {
        id: 'fc_4',
        front: 'Common Exam Pitfall: Does glycolysis require oxygen (O2) to proceed?',
        back: 'No! Glycolysis is strictly anaerobic and takes place in the cytosol, generating a net of 2 ATP and 2 NADH without molecular oxygen.',
        hint: 'Where did ancient organisms generate energy prior to atmospheric oxygen?',
        topic,
      },
    ];
  }

  // General fallback
  return [
    {
      id: 'fc_1',
      front: `What is the foundational definition of ${topic} in ${subject || 'this course'}?`,
      back: `The core governing principle and systematic framework that defines ${topic}.`,
      hint: 'First principles concept.',
      topic,
    },
    {
      id: 'fc_2',
      front: `What critical boundary condition must be verified when solving problems in ${topic}?`,
      back: 'The validity of baseline assumptions and domain constraints before applying quantitative or analytical models.',
      hint: 'Initial conditions and constraints.',
      topic,
    },
    {
      id: 'fc_3',
      front: `What is the most frequent examination trap related to ${topic}?`,
      back: 'Conflating correlation with direct causation, or misapplying a simplified heuristic outside its valid operational range.',
      hint: 'Watch edge cases.',
      topic,
    },
    {
      id: 'fc_4',
      front: `How do you verify whether a solution in ${topic} is conceptually sound?`,
      back: 'Test limiting edge cases and verify dimensions/units against governing conservation laws.',
      hint: 'Dimensional and boundary check.',
      topic,
    },
  ];
}

function generateRescueSchedule(days: number, dailyHours: number, topicsStatus: any[], subjectName: string = '') {
  const schedule: Array<{
    day: number;
    dateLabel: string;
    targetHours: number;
    focus: string;
    priority: string;
    actions: string[];
    tasks: Array<{ timeSlot: string; durationMins: number; topic: string; task: string }>;
  }> = [];
  const count = Math.min(days, 7);

  // Extract weak topic titles if available
  const weakTitles = (topicsStatus || [])
    .filter((t: any) => t.status === 'unknown' || t.status === 'partial' || t.status === 'unfamiliar')
    .map((t: any) => t.title || t.topicTitle);

  for (let i = 1; i <= count; i++) {
    const topicFocus = weakTitles[i - 1] || (topicsStatus[i - 1]?.title) || (i === 1 ? 'Foundational Diagnostic' : i === count ? 'Full Synthesis Mock' : `${subjectName || 'Course'} High-Yield Review`);
    const tasks = [
      {
        timeSlot: '09:00 - 10:15',
        durationMins: Math.min(75, Math.round(dailyHours * 30)),
        topic: topicFocus,
        task: `Review fundamental mechanisms and core notes on ${topicFocus}`,
      },
      {
        timeSlot: '10:30 - 11:45',
        durationMins: Math.min(75, Math.round(dailyHours * 30)),
        topic: topicFocus,
        task: `Work through targeted practice problems and exam edge-cases on ${topicFocus}`,
      },
    ];
    schedule.push({
      day: i,
      dateLabel: `Day ${i} ${i === 1 ? '(Immediate Triage)' : i === count ? '(Final Exam Synthesis)' : ''}`,
      targetHours: dailyHours,
      focus: topicFocus,
      priority: i <= 2 ? 'Critical' : 'High',
      actions: [
        'Review diagnostic spaced-repetition flashcards',
        `Complete 1 adaptive quiz on ${topicFocus} (>80% accuracy target)`,
        'Misconception Clinic: resolve tagged conceptual errors',
      ],
      tasks,
    });
  }
  return schedule;
}

// -------------------------------------------------------------
// Vite Server Integration (Vite dev middleware vs production)
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CogniPulse server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
