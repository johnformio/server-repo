const express = require('express');
const bodyParser = require('body-parser');
const app = express();


const mockTable = [
    {
        "id": "17",
        "firstname": "test",
        "email": "test@test.com",
        "age": 15
    },
    {
        "id": "18",
        "firstname": "example",
        "email": "example@example.com",
        "age": 22
    },
    {
        "id": "19",
        "firstname": "sample",
        "email": "sample@sample.com",
        "age": 30
    },
    {
        "id": "20",
        "firstname": "demo",
        "email": "demo@demo.com",
        "age": 28
    },
    {
        "id": "21",
        "firstname": "user",
        "email": "user@user.com",
        "age": 19
    }
]


app.use(bodyParser.json());

/**
 * NOT USED BY PORTAL FORM
 * Portal forms rely on the data in mongo for displaying tables in Data tab.
 */
app.get('/customers', (req, res) => {
    res.status(200).json({ rows: mockTable });
});

app.post('/customers', (req, res) => {
    const data = req.body.data;
    if (!data.age) {
        return res.status(400).send("Bad Request");
    }

    // Find the highest ID in the mockTable
    const highestId = mockTable.reduce((max, user) => Math.max(max, parseInt(user.id)), 0);
    // Increment the ID
    data.id = (highestId + 1).toString();
    delete data.submit; 
    // Push the new user to the mockTable
    mockTable.push(data);

    res.status(200).json({ rows: [data] });
});

/**
 * NOT USED BY PORTAL FORM
 * Portal forms rely on the data in mongo for displaying tables in Data tab.
 */
app.get('/customers/:id', (req, res) => {
    const item = mockTable[req.params.id]
    res.status(200).json({ rows: [item] });
});

app.put('/customers/:id', (req, res) => {
    const data = req.body.data;
    const userId = req.params.id;
    if (!data.age) {
        return res.status(400).send("Bad Request");
    }

    // Find the user in mockTable by ID
    const userIndex = mockTable.findIndex(user => user.id === userId);
    if (userIndex === -1) {
        return res.status(404).send("Not found");
    }

    // Update user data
    mockTable[userIndex] = { ...mockTable[userIndex], ...data, id: userId };

    // Return the updated user data
    res.status(200).json({ rows: [mockTable[userIndex]] });
});

app.delete('/customers/:id', (req, res) => {
    const userId = req.params.id;

    // Find the user in mockTable by ID
    const userIndex = mockTable.findIndex(user => user.id === userId);
    if (userIndex === -1) {
        return res.status(404).send("Not found");
    }

    // Remove the user from mockTable
    mockTable.splice(userIndex, 1);

    // Check if the table is empty and return the result
    return res.status(200).json({ rows: [] });
});

module.exports = app;
