
const express = require('express');
const axios = require('axios');
const PocketBase = require('pocketbase/cjs');
const cors = require('cors');

require('dotenv').config(); // Load .env file

const DRONE_ID = process.env.DRONE_ID;
console.log("🔍 Fetching drone config for ID:", DRONE_ID);


const PORT = 3000;
const app = express();
const pb = new PocketBase('http://127.0.0.1:8090');

// Middleware
app.use(express.json());
app.use(cors());



// Admin Login (Replace with your PocketBase Admin Credentials)
async function loginAdmin() {
  try {
      await pb.admins.authWithPassword('kiw0580@gmail.com', 'kiw1234567');
      console.log("✅ Admin authenticated successfully");
  } catch (error) {
      console.error("❌ Admin login failed:", error.message);
      process.exit(1); // Stop the server if admin login fails
  }
}

// Run admin login before the server starts
loginAdmin();

// Drone Config Server URL
const DRONE_CONFIG_URL = 'https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLhSYcWRTC3E5p1_tFlJTbsu4XtvnRRYvUAttr_VIkd3RhZron8znQjvqBlWihzShoGzrR6Gk0qHDDuAb6wzjBNbLLu7QEvDGrGYVSO0L9TzjSv24CnLicMCErESb4-5XAY26jJ5v-qlHfpaIw0hhdUL6rMxUfp6knbbSDEwjaRqoiBIV6-f3VbkPnXArY8XxKxtMV7JZVa63qhtigtF65BmY-eYUtXVjs44UnAJyKdLdNCKZdiI1Ix2v9X5clsGz37WZXHbVT79KadYA_N7xVmtJCsK4RbKPCYUPXLF&lib=M9_yccKOaZVEQaYjEvK1gClQlFAuFWsxN';

// Drone Logs
const DRONE_LOG_URL = 'https://app-tracking.pockethost.io/api/collections/drone_logs/records';

app.get('/env-drone', (req, res) => {
  res.json({ drone_id: process.env.DRONE_ID });
});

// Configs
app.get('/configs/:droneId', async (req, res) => {
  try {
    const droneId = req.params.droneId;
    const response = await axios.get(DRONE_CONFIG_URL);
    
    if (!response.data?.data) {
      throw new Error('Invalid data format from config server');
    }

    const searchId = isNaN(droneId) ? droneId : Number(droneId);
    const droneConfig = response.data.data.find(config => 
      config.drone_id === searchId || 
      config.drone_id.toString() === droneId.toString()
    );

    if (!droneConfig) {
      return res.status(404).json({
        error: 'Drone not found'
      });
    }

    // Return ONLY the drone object with specified fields
    res.json({
      drone_id: droneConfig.drone_id,
      drone_name: droneConfig.drone_name,
      light: droneConfig.light,
      country: droneConfig.country,
      weight: droneConfig.weight
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: error.response?.data?.error || error.message
    });
  }
});

// Drone Status
app.get('/status/:droneId', async (req, res) => {
  try {
    const droneId = req.params.droneId;
    const response = await axios.get(DRONE_CONFIG_URL);
    
    if (!response.data?.data) {
      throw new Error('Invalid data format from config server');
    }

    const searchId = isNaN(droneId) ? droneId : Number(droneId);
    const droneConfig = response.data.data.find(config => 
      config.drone_id === searchId || 
      config.drone_id.toString() === droneId.toString()
    );

    if (!droneConfig) {
      return res.status(404).json({
        error: 'Drone not found'
      });
    }

    // Return ONLY the drone object with specified fields
    res.json({
      condition: droneConfig.condition
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: error.response?.data?.error || error.message
    });
  }
});

// Drone Logs
app.get('/logs/:droneId', async (req, res) => {
  try {
    const droneId = req.params.droneId;
    
    // Fetch logs from PocketBase with filtering and field selection
    const response = await axios.get(DRONE_LOG_URL, {
      params: {
        filter: `drone_id = "${droneId}"`,
        sort: '-created',  // Newest first
        perPage: 25,       // Limit to 25 items
        fields: 'drone_id,drone_name,created,country,celsius'
      }
    });

    const logs = response.data?.items || [];
    
    if (logs.length === 0) {
      return res.status(404).json({
        error: 'No logs found for drone ' + droneId
      });
    }

    // Format the response exactly as requested
    const formattedLogs = logs.map(log => ({
      drone_id: log.drone_id,
      drone_name: log.drone_name,
      created: log.created,
      country: log.country,
      celsius: log.celsius
    }));

    res.json(formattedLogs);

  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({
      error: error.response?.data?.message || 'Server error fetching logs'
    });
  }
});

// POST /logs - Create a drone log record
app.post('/logs', async (req, res) => {
  try {
      const { drone_id, drone_name, country, celsius } = req.body;

      // Validate required fields
      if (!drone_id || !drone_name || !country || celsius === undefined) {
          return res.status(400).json({ 
              error: "Missing required fields. Please provide: drone_id, drone_name, country, celsius" 
          });
      }

      // Validate celsius is a number
      if (typeof celsius !== 'number') {
          return res.status(400).json({ 
              error: "celsius must be a number" 
          });
      }

      const logRecord = await pb.collection('drone_logs').create({
          drone_id,
          drone_name,
          country,
          celsius,
      });

      res.status(201).json({ 
          message: "Drone log created successfully", 
      });
  } catch (error) {
      res.status(500).json({ 
          error: "Failed to create drone log",
          details: error.message 
      });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});