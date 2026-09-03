const mongoose = require('mongoose');
const Contest = require('./models/Contest');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const seedContests = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully.");

    await Contest.deleteMany({});

    const contests = [];
    for (let i = 1; i <= 10; i++) {
      contests.push({
        id: `contest-${i}`,
        name: `Contest ${i}`,
        courseId: "1",
        startTime: new Date(),
        endTime: new Date(new Date().getTime() + 60 * 60 * 1000), // 1 hour from now
        description: `This is test contest ${i}.`,
      });
    }

    await Contest.insertMany(contests);
    console.log("Successfully seeded 10 contests.");

    process.exit(0);
  } catch (error) {
    console.error("Error seeding contests:", error);
    process.exit(1);
  }
};

seedContests();
