const express = require('express');
const router = express.Router();
const Course = require('../../models/Course');
const CourseModule = require('../../models/CourseModule');
const Topic = require('../../models/Topic');
const Problem = require('../../models/Problem');

// Middleware to check admin role (assuming attached by main server)
const requireAdmin = (req, res, next) => {
    // This expects req.user to be populated by the auth middleware in server.js
    // For now, we'll assume the main server.js handles the Clerk auth and user lookup before mounting this router,
    // OR we re-implement the check here. 
    // Best practice: The main server.js should mount this router protected by auth middleware.
    next(); 
};

// --- MODULE MANAGEMENT ---

// Create a Module for a Course
router.post('/modules', async (req, res) => {
    try {
        const { courseId, title, description } = req.body; // courseId is the Custom ID (e.g. "web-dev")

        const course = await Course.findOne({ id: courseId });
        if (!course) return res.status(404).json({ msg: 'Course not found' });

        const moduleId = `${courseId}-mod-${Date.now()}`; // Generate a unique custom ID

        const newModule = new CourseModule({
            id: moduleId,
            title,
            description,
            course: course._id,
            topics: []
        });

        await newModule.save();

        // Link to course
        course.modules.push(newModule._id);
        course.moduleIds.push(moduleId);
        await course.save();

        res.json(newModule);
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Update Module
router.put('/modules/:id', async (req, res) => {
    try {
        const { title, description } = req.body;
        // Search by Custom ID or Mongo ID? Let's support Custom ID as per schema
        const module = await CourseModule.findOne({ id: req.params.id });
        
        if (!module) return res.status(404).json({ msg: 'Module not found' });

        if (title) module.title = title;
        if (description) module.description = description;

        await module.save();
        res.json(module);
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Delete Module
router.delete('/modules/:id', async (req, res) => {
    try {
        const module = await CourseModule.findOne({ id: req.params.id });
        if (!module) return res.status(404).json({ msg: 'Module not found' });

        // Remove from Course
        await Course.updateOne(
            { _id: module.course },
            { $pull: { modules: module._id, moduleIds: module.id } }
        );

        // Cascading Delete: Delete all Topics inside this module
        // 1. Find all topics
        const topics = await Topic.find({ module: module._id });
        
        // 2. For each topic, delete its problems
        for (const topic of topics) {
             // Delete Problems linked to this topic
             await Problem.deleteMany({ _id: { $in: topic.problems } });
             // If you have videos, delete them too (optional/future)
             // await Video.deleteMany({ _id: { $in: topic.videos } });
        }

        // 3. Delete the topics themselves
        await Topic.deleteMany({ module: module._id });
        
        await CourseModule.findByIdAndDelete(module._id);
        res.json({ msg: 'Module deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Server Error' });
    }
});


// --- TOPIC MANAGEMENT ---

// Create Topic in a Module
router.post('/topics', async (req, res) => {
    try {
        const { moduleId, title, description, type } = req.body; // type: 'problem' | 'video' | 'reading'
        
        const module = await CourseModule.findOne({ id: moduleId });
        if (!module) return res.status(404).json({ msg: 'Module not found' });

        const topicId = `${moduleId}-top-${Date.now()}`;

        const newTopic = new Topic({
            id: topicId,
            title,
            description,
            type: type || 'problem',
            module: module._id
        });

        await newTopic.save();

        module.topics.push(newTopic._id);
        module.topicIds.push(topicId);
        await module.save();

        res.json(newTopic);
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Update Topic
router.put('/topics/:id', async (req, res) => {
    try {
        const { title, description } = req.body;
        const topic = await Topic.findOne({ id: req.params.id });
        
        if (!topic) return res.status(404).json({ msg: 'Topic not found' });

        if (title) topic.title = title;
        if (description) topic.description = description;

        await topic.save();
        res.json(topic);
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Delete Topic
router.delete('/topics/:id', async (req, res) => {
    try {
        const topic = await Topic.findOne({ id: req.params.id });
        if (!topic) return res.status(404).json({ msg: 'Topic not found' });

        await CourseModule.updateOne(
            { _id: topic.module },
            { $pull: { topics: topic._id, topicIds: topic.id } }
        );

        // Cascading Delete: Delete all Problems inside this topic
        if (topic.problems && topic.problems.length > 0) {
            await Problem.deleteMany({ _id: { $in: topic.problems } });
        }

        await Topic.findByIdAndDelete(topic._id);
        res.json({ msg: 'Topic deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Server Error' });
    }
});


// --- PROBLEM MANAGEMENT (The Core) ---

// Get Problem Details (for editing)
router.get('/problems/:id', async (req, res) => {
    try {
        const problem = await Problem.findOne({ id: req.params.id });
        if (!problem) return res.status(404).json({ msg: 'Problem not found' });
        res.json(problem);
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Create/Link Problem to a Topic
router.post('/problems', async (req, res) => {
    try {
        const { topicId, title, description, difficulty, sampleTestCases, hiddenTestCases, timeLimit, constraints, category, inputFormat, outputFormat } = req.body;

        const topic = await Topic.findOne({ id: topicId });
        if (!topic) return res.status(404).json({ msg: 'Topic not found' });

        const problemId = `prob-${Date.now()}`;

        const newProblem = new Problem({
            id: problemId,
            title,
            description,
            difficulty: difficulty || 'Medium',
            category: category || "General",
            inputFormat: inputFormat || "Standard Input",
            outputFormat: outputFormat || "Standard Output",
            constraints: constraints || "Time Limit: 1s",
            sampleTestCases: sampleTestCases || [],
            hiddenTestCases: hiddenTestCases || [],
            timeLimit: timeLimit || 1000
        });

        await newProblem.save();

        // Link to Topic (Assuming Topic has a 'problems' array or single 'problem' ref)
        // Adjusting based on your schema. If Topic is 1-to-1 with content, we link it.
        // If Topic acts as a container for ONE problem:
        topic.problems.push(newProblem._id); 
        await topic.save();

        res.json(newProblem);
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Update Problem
router.put('/problems/:id', async (req, res) => {
    try {
        const { title, description, difficulty, sampleTestCases, hiddenTestCases, constraints, category, inputFormat, outputFormat } = req.body;
        const problem = await Problem.findOne({ id: req.params.id });

        if (!problem) return res.status(404).json({ msg: 'Problem not found' });

        if (title) problem.title = title;
        if (description) problem.description = description;
        if (difficulty) problem.difficulty = difficulty;
        if (constraints) problem.constraints = constraints;
        if (category) problem.category = category;
        if (inputFormat) problem.inputFormat = inputFormat;
        if (outputFormat) problem.outputFormat = outputFormat;
        if (sampleTestCases) problem.sampleTestCases = sampleTestCases;
        if (hiddenTestCases) problem.hiddenTestCases = hiddenTestCases;

        await problem.save();
        res.json(problem);
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Delete Problem
router.delete('/problems/:id', async (req, res) => {
    try {
        const problem = await Problem.findOne({ id: req.params.id });
        if (!problem) return res.status(404).json({ msg: 'Problem not found' });

        // Remove from Topic (we need to find the topic that has this problem)
        // Since Problem schema has 'topic' ref, we can use that, or search.
        // Let's search to be safe if the ref is missing.
        await Topic.updateOne(
            { problems: problem._id },
            { $pull: { problems: problem._id, problemIds: problem.id } } // Adjust if you use problemIds array
        );
        
        // Also if the problem stores the topic ref, we can double check
        if (problem.topic) {
             await Topic.findByIdAndUpdate(problem.topic, {
                $pull: { problems: problem._id }
             });
        }

        await Problem.findByIdAndDelete(problem._id);
        res.json({ msg: 'Problem deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;
