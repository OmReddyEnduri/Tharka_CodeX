export interface TestCase {
  input: string;
  output: string;
}

export interface Problem {
  id: number;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  constraints?: string;
  inputFormat: string;
  outputFormat: string;
  timeLimit: number;
  memoryLimit: number;
  sampleTestCases: TestCase[];
  hiddenTestCases?: TestCase[];
}

export interface Video {
  title: string;
  url: string;
  description?: string;
}

export interface Topic {
  title: string;
  description: string;
  problems: Problem[];
  videos: Video[];
}

export interface CourseModule {
  title: string;
  description?: string;
  topics: Topic[];
}

export interface Course {
  _id?: string; // MongoDB ID
  id: string;   // Custom ID (e.g., "1", "basic-prog")
  name: string;
  provider: string;
  description: string[];
  amount: number;
  modules?: CourseModule[];
}

// Keeping the array for fallback/static usage if needed, but updated type
export const courses: Course[] = [
  {
    id: "1",
    name: "Basic Programming",
    provider: "Tharka High School",
    description: [
      "Introduction to Computers & Programming",
      "Variables, Data Types, and Operators",
      "Input/Output and Basic Syntax",
      "Conditional Statements and Loops",
      "Simple Projects & Problem Solving",
    ],
    amount: 1,
  },
  {
    id: "2",
    name: "Basic DSA",
    provider: "Tharka High School",
    description: [
      "Introduction to Data Structures",
      "Arrays and Strings",
      "Stacks and Queues",
      "Linked Lists",
      "Basic Searching & Sorting Algorithms",
    ],
    amount: 999,
  },
  {
    id: "3",
    name: "Advanced DSA",
    provider: "Tharka High School",
    description: [
      "Trees and Graphs",
      "Advanced Searching & Sorting",
      "Recursion and Dynamic Programming",
      "Hashing and Heaps",
      "Algorithmic Problem Solving",
    ],
    amount: 1499,
  },
];