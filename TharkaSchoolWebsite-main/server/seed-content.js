const mongoose = require('mongoose');
const Course = require('./models/Course');
const CourseModule = require('./models/CourseModule');
const Topic = require('./models/Topic');
const Problem = require('./models/Problem');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const sourceData = [
  {
    "id": 201,
    "title": "Sum of Two Numbers",
    "description": "Your task is to calculate the sum of two given integers.",
    "inputFormat": "The input consists of a single line containing two space-separated integers A and B.",
    "outputFormat": "Print the sum of A and B on a single line.",
    "category": "introductory",
    "difficulty": "Easy",
    "constraints": {
      "timeLimit": 1000,
      "memoryLimit": 256,
      "inputConstraints": "-10^9 ≤ A, B ≤ 10^9"
    },
    "testCases": [ { "input": "2 3\n", "output": "5\n" }, { "input": "-5 10\n", "output": "5\n" } ],
    "hiddenTestCases": [ { "input": "100 200\n", "output": "300\n" }, { "input": "-10 -20\n", "output": "-30\n" }, { "input": "0 0\n", "output": "0\n" }, { "input": "999999999 1\n", "output": "1000000000\n" } ]
  },
  {
    "id": 202,
    "title": "Difference of Two Numbers",
    "description": "Your task is to calculate the difference between two given integers.",
    "inputFormat": "The input consists of a single line containing two space-separated integers A and B.",
    "outputFormat": "Print the result of A - B on a single line.",
    "category": "introductory",
    "difficulty": "Easy",
    "constraints": {
      "timeLimit": 1000,
      "memoryLimit": 256,
      "inputConstraints": "-10^9 ≤ A, B ≤ 10^9"
    },
    "testCases": [ { "input": "5 3\n", "output": "2\n" }, { "input": "3 5\n", "output": "-2\n" } ],
    "hiddenTestCases": [ { "input": "10 10\n", "output": "0\n" }, { "input": "0 5\n", "output": "-5\n" }, { "input": "-10 -20\n", "output": "10\n" }, { "input": "1000000000 1\n", "output": "999999999\n" } ]
  },
  {
    "id": 203,
    "title": "Product of Two Numbers",
    "description": "Your task is to calculate the product of two given integers.",
    "inputFormat": "The input consists of a single line containing two space-separated integers A and B.",
    "outputFormat": "Print the product of A and B on a single line.",
    "category": "introductory",
    "difficulty": "Easy",
    "constraints": {
      "timeLimit": 1000,
      "memoryLimit": 256,
      "inputConstraints": "-10^6 ≤ A, B ≤ 10^6"
    },
    "testCases": [ { "input": "4 5\n", "output": "20\n" }, { "input": "-3 6\n", "output": "-18\n" } ],
    "hiddenTestCases": [ { "input": "0 100\n", "output": "0\n" }, { "input": "-10 -10\n", "output": "100\n" }, { "input": "1000 1000\n", "output": "1000000\n" }, { "input": "1 -1\n", "output": "-1\n" } ]
  },
  {
    "id": 204,
    "title": "Maximum of Two Numbers",
    "description": "Your task is to find the larger of two given integers.",
    "inputFormat": "The input consists of a single line containing two space-separated integers A and B.",
    "outputFormat": "Print the maximum of the two integers.",
    "category": "introductory",
    "difficulty": "Easy",
    "constraints": {
      "timeLimit": 1000,
      "memoryLimit": 128,
      "inputConstraints": "-10^9 ≤ A, B ≤ 10^9"
    },
    "testCases": [ { "input": "7 3\n", "output": "7\n" }, { "input": "-2 -5\n", "output": "-2\n" } ],
    "hiddenTestCases": [ { "input": "10 10\n", "output": "10\n" }, { "input": "-10 0\n", "output": "0\n" }, { "input": "5 100\n", "output": "100\n" }, { "input": "-100 -50\n", "output": "-50\n" } ]
  },
  {
    "id": 205,
    "title": "Minimum of Two Numbers",
    "description": "Your task is to find the smaller of two given integers.",
    "inputFormat": "The input consists of a single line containing two space-separated integers A and B.",
    "outputFormat": "Print the minimum of the two integers.",
    "category": "introductory",
    "difficulty": "Easy",
    "constraints": {
      "timeLimit": 1000,
      "memoryLimit": 128,
      "inputConstraints": "-10^9 ≤ A, B ≤ 10^9"
    },
    "testCases": [ { "input": "7 3\n", "output": "3\n" }, { "input": "-2 -5\n", "output": "-5\n" } ],
    "hiddenTestCases": [ { "input": "0 0\n", "output": "0\n" }, { "input": "-10 10\n", "output": "-10\n" }, { "input": "100 5\n", "output": "5\n" }, { "input": "-50 -100\n", "output": "-100\n" } ]
  },
  {
    "id": 206,
    "title": "Even or Odd",
    "description": "Your task is to determine whether a given integer is even or odd.",
    "inputFormat": "The input consists of a single line containing an integer N.",
    "outputFormat": "Print 'EVEN' if the number is even, and 'ODD' if the number is odd.",
    "category": "introductory",
    "difficulty": "Easy",
    "constraints": {
      "timeLimit": 1000,
      "memoryLimit": 128,
      "inputConstraints": "-10^9 ≤ N ≤ 10^9"
    },
    "testCases": [ { "input": "4\n", "output": "EVEN\n" }, { "input": "7\n", "output": "ODD\n" } ],
    "hiddenTestCases": [ { "input": "0\n", "output": "EVEN\n" }, { "input": "-2\n", "output": "EVEN\n" }, { "input": "-5\n", "output": "ODD\n" }, { "input": "1000000000\n", "output": "EVEN\n" } ]
  },
  {
    "id": 207,
    "title": "Sum of First N Numbers",
    "description": "Your task is to calculate the sum of the first N positive integers (1 + 2 + ... + N).",
    "inputFormat": "The input consists of a single line containing an integer N.",
    "outputFormat": "Print the sum of the first N integers.",
    "category": "introductory",
    "difficulty": "Medium",
    "constraints": {
      "timeLimit": 1000,
      "memoryLimit": 128,
      "inputConstraints": "1 ≤ N ≤ 10^9"
    },
    "testCases": [ { "input": "5\n", "output": "15\n" }, { "input": "10\n", "output": "55\n" } ],
    "hiddenTestCases": [ { "input": "1\n", "output": "1\n" }, { "input": "100\n", "output": "5050\n" }, { "input": "2\n", "output": "3\n" }, { "input": "1000\n", "output": "500500\n" } ]
  },
  {
    "id": 208,
    "title": "Factorial of a Number",
    "description": "Your task is to calculate the factorial of a given integer N.",
    "inputFormat": "The input consists of a single line containing an integer N.",
    "outputFormat": "Print the factorial of N.",
    "category": "introductory",
    "difficulty": "Medium",
    "constraints": {
      "timeLimit": 1000,
      "memoryLimit": 128,
      "inputConstraints": "0 ≤ N ≤ 20"
    },
    "testCases": [ { "input": "5\n", "output": "120\n" }, { "input": "0\n", "output": "1\n" } ],
    "hiddenTestCases": [ { "input": "1\n", "output": "1\n" }, { "input": "3\n", "output": "6\n" }, { "input": "6\n", "output": "720\n" }, { "input": "10\n", "output": "3628800\n" } ]
  },
  {
    "id": 209,
    "title": "Count Digits",
    "description": "Your task is to count the number of digits in a given non-negative integer N.",
    "inputFormat": "The input consists of a single line containing an integer N.",
    "outputFormat": "Print the number of digits in N.",
    "category": "introductory",
    "difficulty": "Medium",
    "constraints": {
      "timeLimit": 1000,
      "memoryLimit": 128,
      "inputConstraints": "0 ≤ N ≤ 10^18"
    },
    "testCases": [ { "input": "12345\n", "output": "5\n" }, { "input": "0\n", "output": "1\n" } ],
    "hiddenTestCases": [ { "input": "9\n", "output": "1\n" }, { "input": "10\n", "output": "2\n" }, { "input": "99\n", "output": "2\n" }, { "input": "1000000\n", "output": "7\n" } ]
  },
  {
    "id": 210,
    "title": "Check Prime Number",
    "description": "Your task is to determine whether a given positive integer N is a prime number.",
    "inputFormat": "The input consists of a single line containing an integer N.",
    "outputFormat": "Print 'YES' if N is prime, and 'NO' otherwise.",
    "category": "introductory",
    "difficulty": "Medium",
    "constraints": {
      "timeLimit": 1000,
      "memoryLimit": 128,
      "inputConstraints": "1 ≤ N ≤ 10^9"
    },
    "testCases": [ { "input": "7\n", "output": "YES\n" }, { "input": "10\n", "output": "NO\n" } ],
    "hiddenTestCases": [ { "input": "2\n", "output": "YES\n" }, { "input": "1\n", "output": "NO\n" }, { "input": "97\n", "output": "YES\n" }, { "input": "100\n", "output": "NO\n" } ]
  },

  // --- DYNAMIC PROGRAMMING PROBLEMS ---
  {
    "id": 301,
    "title": "Climbing Stairs",
    "description": "You are climbing a staircase. It takes N steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?",
    "inputFormat": "The input consists of a single integer N.",
    "outputFormat": "Print the number of ways modulo 10^9+7.",
    "category": "dynamic programming",
    "difficulty": "Easy",
    "constraints": {
      "timeLimit": 1000,
      "memoryLimit": 256,
      "inputConstraints": "1 ≤ N ≤ 10^5"
    },
    "testCases": [ { "input": "2\n", "output": "2\n" }, { "input": "3\n", "output": "3\n" } ],
    "hiddenTestCases": [ { "input": "1\n", "output": "1\n" }, { "input": "4\n", "output": "5\n" }, { "input": "5\n", "output": "8\n" }, { "input": "10\n", "output": "89\n" } ]
  },
  {
    "id": 302,
    "title": "Coin Change I",
    "description": "Given a set of coin values and a target sum, your task is to find the number of distinct ways to make the sum. You can use each coin any number of times.",
    "inputFormat": "The first line contains two integers N and X: the number of coins and the target sum.\nThe second line contains N integers c_1, c_2, ..., c_N: the values of each coin.",
    "outputFormat": "Print the number of ways modulo 10^9+7.",
    "category": "dynamic programming",
    "difficulty": "Medium",
    "constraints": {
      "timeLimit": 1000,
      "memoryLimit": 256,
      "inputConstraints": "1 ≤ N ≤ 100, 1 ≤ X ≤ 10^6"
    },
    "testCases": [ { "input": "3 9\n2 3 5\n", "output": "8\n" }, { "input": "1 5\n2\n", "output": "0\n" } ],
    "hiddenTestCases": [ { "input": "2 10\n2 5\n", "output": "2\n" }, { "input": "1 10\n1\n", "output": "1\n" }, { "input": "3 6\n1 2 3\n", "output": "7\n" }, { "input": "3 4\n1 2 3\n", "output": "4\n" } ]
  },
  {
    "id": 303,
    "title": "Longest Increasing Subsequence",
    "description": "Given an array of N integers, find the length of the longest strictly increasing subsequence.",
    "inputFormat": "The first line contains an integer N.\nThe second line contains N integers representing the array.",
    "outputFormat": "Print a single integer: the length of the longest increasing subsequence.",
    "category": "dynamic programming",
    "difficulty": "Medium",
    "constraints": {
      "timeLimit": 1000,
      "memoryLimit": 256,
      "inputConstraints": "1 ≤ N ≤ 2*10^5"
    },
    "testCases": [ { "input": "8\n7 3 5 3 6 2 9 8\n", "output": "4\n" }, { "input": "5\n1 2 3 4 5\n", "output": "5\n" } ],
    "hiddenTestCases": [ { "input": "5\n5 4 3 2 1\n", "output": "1\n" }, { "input": "5\n1 1 1 1 1\n", "output": "1\n" }, { "input": "6\n1 3 2 4 3 5\n", "output": "4\n" }, { "input": "3\n10 20 30\n", "output": "3\n" } ]
  },
  {
    "id": 304,
    "title": "Minimizing Coins",
    "description": "Consider a money system consisting of N coins. Each coin has a positive integer value. Your task is to produce a sum of money X using the available coins in such a way that the number of coins is minimal.",
    "inputFormat": "The first line contains two integers N and X: the number of coins and the target sum.\nThe second line contains N integers c_1, c_2, ..., c_N: the values of each coin.",
    "outputFormat": "Print the minimum number of coins. If it is not possible to produce the sum, print -1.",
    "category": "dynamic programming",
    "difficulty": "Medium",
    "constraints": {
      "timeLimit": 1000,
      "memoryLimit": 256,
      "inputConstraints": "1 ≤ N ≤ 100, 1 ≤ X ≤ 10^6"
    },
    "testCases": [ { "input": "3 11\n1 5 7\n", "output": "3\n" }, { "input": "2 5\n2 4\n", "output": "-1\n" } ],
    "hiddenTestCases": [ { "input": "1 10\n1\n", "output": "10\n" }, { "input": "1 10\n2\n", "output": "5\n" }, { "input": "2 10\n3 4\n", "output": "3\n" }, { "input": "3 10\n1 2 5\n", "output": "2\n" } ]
  },
  {
    "id": 305,
    "title": "Grid Paths",
    "description": "Consider an N x N grid whose squares may have traps. It is not allowed to move to a square with a trap. Your task is to calculate the number of paths from the upper-left square to the lower-right square. You can only move right or down.",
    "inputFormat": "The first line contains an integer N: the size of the grid.\nThe following N lines describe the grid. Each line has N characters: . denotes an empty cell, and * denotes a trap.",
    "outputFormat": "Print the number of paths modulo 10^9+7.",
    "category": "dynamic programming",
    "difficulty": "Medium",
    "constraints": {
      "timeLimit": 1000,
      "memoryLimit": 256,
      "inputConstraints": "1 ≤ N ≤ 1000"
    },
    "testCases": [ { "input": "4\n....\n.*..\n...*\n*...\n", "output": "3\n" }, { "input": "3\n...\n...\n...\n", "output": "6\n" } ],
    "hiddenTestCases": [ { "input": "2\n..\n..\n", "output": "2\n" }, { "input": "2\n.*\n..\n", "output": "0\n" }, { "input": "3\n.*.\n...\n...\n", "output": "3\n" }, { "input": "1\n.\n", "output": "1\n" } ]
  },

  // --- GRAPH ALGORITHMS ---
  {
    "id": 401,
    "title": "Counting Rooms",
    "description": "You are given a map of a building, and your task is to count the number of its rooms. The size of the map is N x M squares, and each square is either floor (.) or wall (#). You can walk left, right, up, and down through the floor squares.",
    "inputFormat": "The first line contains two integers N and M: the height and width of the map.\nThen there are N lines of M characters describing the map.",
    "outputFormat": "Print one integer: the number of rooms.",
    "category": "graph",
    "difficulty": "Medium",
    "constraints": {
      "timeLimit": 1000,
      "memoryLimit": 256,
      "inputConstraints": "1 ≤ N, M ≤ 1000"
    },
    "testCases": [ { "input": "5 8\n########\n#..#...#\n####.#.#\n#..#...#\n########\n", "output": "3\n" }, { "input": "3 3\n###\n###\n###\n", "output": "0\n" } ],
    "hiddenTestCases": [ { "input": "3 3\n...\n...\n...\n", "output": "1\n" }, { "input": "4 4\n#.#.\n.#.#\n#.#.\n.#.#\n", "output": "8\n" }, { "input": "1 5\n.....\n", "output": "1\n" }, { "input": "5 1\n.\n.\n.\n.\n.\n", "output": "1\n" } ]
  },
  {
    "id": 402,
    "title": "Labyrinth",
    "description": "You are given a map of a labyrinth, and your task is to find a path from start (A) to end (B). You can walk left, right, up, and down.",
    "inputFormat": "The first line contains two integers N and M: the height and width of the map.\nThen there are N lines of M characters describing the map.",
    "outputFormat": "Print 'YES' if a path exists, and 'NO' otherwise.",
    "category": "graph",
    "difficulty": "Medium",
    "constraints": {
      "timeLimit": 1000,
      "memoryLimit": 256,
      "inputConstraints": "1 ≤ N, M ≤ 1000"
    },
    "testCases": [ { "input": "5 8\n########\n#.A#...#\n#.##.#B#\n#......#\n########\n", "output": "YES\n" }, { "input": "3 3\n###\n#A#\n#B#\n", "output": "NO\n" } ],
    "hiddenTestCases": [ { "input": "2 2\nAB\n..\n", "output": "YES\n" }, { "input": "2 2\nA#\n#B\n", "output": "NO\n" }, { "input": "1 5\nA...B\n", "output": "YES\n" }, { "input": "5 1\nA\n.\n.\n.\nB\n", "output": "YES\n" } ]
  },
  {
    "id": 403,
    "title": "Building Roads",
    "description": "Byteland has N cities and M roads between them. The goal is to make all cities reachable from each other. Your task is to find the minimum number of new roads required.",
    "inputFormat": "The first line contains two integers N and M: the number of cities and roads. The cities are numbered 1, ..., N.\nThen there are M lines describing the roads. Each line has two integers a and b: there is a road between those cities.",
    "outputFormat": "Print one integer: the number of new roads required.",
    "category": "graph",
    "difficulty": "Medium",
    "constraints": {
      "timeLimit": 1000,
      "memoryLimit": 256,
      "inputConstraints": "1 ≤ N ≤ 10^5, 0 ≤ M ≤ 2*10^5"
    },
    "testCases": [ { "input": "4 2\n1 2\n3 4\n", "output": "1\n" }, { "input": "5 0\n", "output": "4\n" } ],
    "hiddenTestCases": [ { "input": "4 3\n1 2\n2 3\n3 4\n", "output": "0\n" }, { "input": "1 0\n", "output": "0\n" }, { "input": "3 1\n1 2\n", "output": "1\n" }, { "input": "6 3\n1 2\n3 4\n5 6\n", "output": "2\n" } ]
  },
  {
    "id": 404,
    "title": "Message Route",
    "description": "Syrjälä's network consists of N computers and M connections. Your task is to find if Uolevi can send a message to Maija, and if so, what is the minimum number of computers on such a route.",
    "inputFormat": "The first line contains two integers N and M: the number of computers and connections.\nThen there are M lines describing the connections.",
    "outputFormat": "Print the minimum number of computers on a valid route. If there is no route, print IMPOSSIBLE.",
    "category": "graph",
    "difficulty": "Medium",
    "constraints": {
      "timeLimit": 1000,
      "memoryLimit": 256,
      "inputConstraints": "1 ≤ N ≤ 10^5, 0 ≤ M ≤ 2*10^5"
    },
    "testCases": [ { "input": "5 5\n1 2\n1 3\n1 4\n2 3\n5 4\n", "output": "3\n" }, { "input": "3 1\n1 2\n", "output": "IMPOSSIBLE\n" } ],
    "hiddenTestCases": [ { "input": "2 1\n1 2\n", "output": "2\n" }, { "input": "4 3\n1 2\n2 3\n3 4\n", "output": "4\n" }, { "input": "5 4\n1 2\n2 3\n4 5\n1 5\n", "output": "2\n" }, { "input": "2 0\n", "output": "IMPOSSIBLE\n" } ]
  },
  {
    "id": 405,
    "title": "Building Teams",
    "description": "There are N pupils in Uolevi's class, and M friendships between them. Your task is to divide the pupils into two teams in such a way that no two pupils in a team are friends.",
    "inputFormat": "The first line contains two integers N and M: the number of pupils and friendships.\nThen there are M lines describing the friendships.",
    "outputFormat": "Print 'POSSIBLE' if a valid division exists, and 'IMPOSSIBLE' otherwise.",
    "category": "graph",
    "difficulty": "Medium",
    "constraints": {
      "timeLimit": 1000,
      "memoryLimit": 256,
      "inputConstraints": "1 ≤ N ≤ 10^5, 0 ≤ M ≤ 2*10^5"
    },
    "testCases": [ { "input": "5 3\n1 2\n1 3\n4 5\n", "output": "POSSIBLE\n" }, { "input": "3 3\n1 2\n2 3\n1 3\n", "output": "IMPOSSIBLE\n" } ],
    "hiddenTestCases": [ { "input": "4 4\n1 2\n2 3\n3 4\n4 1\n", "output": "POSSIBLE\n" }, { "input": "2 1\n1 2\n", "output": "POSSIBLE\n" }, { "input": "5 5\n1 2\n2 3\n3 4\n4 5\n5 1\n", "output": "IMPOSSIBLE\n" }, { "input": "1 0\n", "output": "POSSIBLE\n" } ]
  }
];

const seedContent = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully.");

    // Clear existing content
    await CourseModule.deleteMany({});
    await Topic.deleteMany({});
    await Problem.deleteMany({});

    // 1. Create Problems
    console.log("Creating Problems...");
    const formattedProblems = sourceData.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      category: p.category,
      difficulty: p.difficulty,
      constraints: p.constraints.inputConstraints || "See description",
      inputFormat: p.inputFormat || "See description",
      outputFormat: p.outputFormat || "See description",
      timeLimit: p.constraints.timeLimit || p.timeLimit,
      memoryLimit: p.constraints.memoryLimit || p.memoryLimit,
      sampleTestCases: p.testCases,
      hiddenTestCases: p.hiddenTestCases || []
    }));

    const createdProblems = await Problem.insertMany(formattedProblems);
    console.log(`Created ${createdProblems.length} problems.`);

    // Helper to get problem ObjectIds by their custom ID
    const getProbIds = (start, end) => 
      createdProblems
        .filter(p => p.id >= start && p.id <= end)
        .map(p => p._id);
    
    const getProbCustomIds = (start, end) =>
        createdProblems
          .filter(p => p.id >= start && p.id <= end)
          .map(p => p.id);

    // 2. Create Topics
    console.log("Creating Topics...");
    const topicIntro = await Topic.create({
      id: "topic-intro",
      title: "Introduction",
      description: "Basic programming concepts and logic.",
      problemIds: getProbCustomIds(201, 210),
      problems: getProbIds(201, 210)
    });

    const topicDP = await Topic.create({
      id: "topic-dp",
      title: "Dynamic Programming",
      description: "Optimization problems using memoization and tabulation.",
      problemIds: getProbCustomIds(301, 305),
      problems: getProbIds(301, 305)
    });

    const topicGraph = await Topic.create({
        id: "topic-graph",
        title: "Graph Algorithms",
        description: "DFS, BFS, and graph traversals.",
        problemIds: getProbCustomIds(401, 405),
        problems: getProbIds(401, 405)
      });

    // 2.1 Back-link Problems to Topics
    await Problem.updateMany({ id: { $gte: 201, $lte: 210 } }, { topic: topicIntro._id });
    await Problem.updateMany({ id: { $gte: 301, $lte: 305 } }, { topic: topicDP._id });
    await Problem.updateMany({ id: { $gte: 401, $lte: 405 } }, { topic: topicGraph._id });


    // 3. Create Modules
    console.log("Creating Modules...");
    const modIntro = await CourseModule.create({
        id: "mod-intro",
        title: "Programming Basics",
        description: "Start your journey here.",
        topicIds: ["topic-intro"],
        topics: [topicIntro._id]
    });

    const modAdvanced = await CourseModule.create({
        id: "mod-adv",
        title: "Advanced Algorithms",
        description: "Master complex algorithms.",
        topicIds: ["topic-dp", "topic-graph"],
        topics: [topicDP._id, topicGraph._id]
    });

    // 3.1 Back-link Topics to Modules
    await Topic.updateOne({ _id: topicIntro._id }, { courseModule: modIntro._id });
    await Topic.updateMany({ _id: { $in: [topicDP._id, topicGraph._id] } }, { courseModule: modAdvanced._id });


    // 4. Update Course
    console.log("Updating Course...");
    const course = await Course.findOneAndUpdate(
        { id: "1" },
        { 
            moduleIds: ["mod-intro", "mod-adv"],
            modules: [modIntro._id, modAdvanced._id] 
        },
        { new: true, upsert: true } 
    );

    // 4.1 Back-link Modules to Course
    await CourseModule.updateMany({ _id: { $in: [modIntro._id, modAdvanced._id] } }, { course: course._id });

    console.log("Seeding complete with Full Structure!");
    process.exit(0);

  } catch (error) {
    console.error("Error seeding content:", error);
    process.exit(1);
  }
};

seedContent();