require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const http = require("http");
const socketIo = require("socket.io");
const { Message, Conversation, User } = require("./src/models");
const { Op } = require("sequelize");
const { authenticate } = require("./src/middleware/auth");

const { sequelize } = require("./src/models");
const authRoutes = require("./src/routes/auth.routes");
const { ensureAdmin } = require("./src/setup/ensureAdmin");

// ---------------------------
// Express App Setup
// ---------------------------
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// 🔒 Security headers
app.use(helmet());

// 🌍 Allow frontend apps to connect
app.use(cors({ origin: true, credentials: true }));

// 📦 Parse JSON bodies
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// 📝 Logging
app.use(morgan("dev"));

// ✅ Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", ts: Date.now() });
});

// ⏱️ Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100, // limit per IP
});
app.use("/api/auth", limiter, authRoutes);

const onboardingRoutes = require("./src/routes/onboarding.routes");
app.use("/api/onboarding", onboardingRoutes)

const jobRoutes = require("./src/routes/job.routes");
app.use("/api/jobs", jobRoutes)

app.use("/api/public", require("./src/routes/public.routes"));

app.use("/api/categories", require("./src/routes/category.routes"));

const eventRoutes = require("./src/routes/event.routes");
app.use("/api/events", eventRoutes);

const serviceRoutes = require("./src/routes/service.routes");
app.use("/api/services", serviceRoutes);

const productRoutes = require("./src/routes/product.routes");
app.use("/api/products", productRoutes);

const tourismRoutes = require("./src/routes/tourism.routes");
app.use("/api/tourism", tourismRoutes);

const fundingRoutes = require("./src/routes/funding.routes");
app.use("/api/funding", fundingRoutes);

const feedRoutes = require("./src/routes/feed.routes");
app.use("/api", feedRoutes);

// index.js or src/app.js
app.use("/api", require("./src/routes/profile.routes"));

const adminRoutes = require("./src/routes/admin.routes");
app.use("/api", adminRoutes);

const peopleRoutes = require("./src/routes/people.routes");
app.use("/api/people", peopleRoutes);

app.use("/api", require("./src/routes/user.routes"));

app.use("/api", require("./src/routes/connection.routes"));

// Message routes
app.use("/api/messages", require("./src/routes/message.routes"));

const publicRoutes = require("./src/routes/public.routes");

app.use("/api/public", publicRoutes);



// ❌ 404 handler
app.use((req, res) => res.status(404).json({ message: "Not found" }));

// ⚠️ Error handler
app.use((err, req, res, next) => {
  console.error(err); // log error
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

// ---------------------------
// Start Server + DB
// ---------------------------
const PORT = process.env.PORT || 5000;

const { seedIfEmpty } = require("./src/utils/seed");
const seedAll = require("./src/seeds/seedAll");




(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // Auto-sync DB tables (use migrations in production)
    // Temporarily disable alter:true to avoid "Too many keys" error
    await sequelize.sync({ alter: false });
    
    // 👉 Run seeding if needed
    //await seedIfEmpty();

    //await seedAll();

    // 🔑 Ensure default admin exists
    await ensureAdmin();

    require('./scripts/seed.from.singlefile.js')

    // Track online users
    const onlineUsers = new Map();

    // Socket.IO setup
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error("Authentication error"));
        }
        
        // Verify the token
        const decoded = await authenticate(token);
        if (!decoded) {
          return next(new Error("Authentication error"));
        }
        
        // Store user info in socket
        socket.userId = decoded.sub;
        socket.user = await User.findByPk(decoded.sub);
        next();
      } catch (error) {
        next(new Error("Authentication error"));
      }
    });

    io.on("connection", (socket) => {
      console.log(`User connected: ${socket.userId}`);
      
      // Add user to online users map
      onlineUsers.set(socket.userId, {
        userId: socket.userId,
        socketId: socket.id,
        user: {
          id: socket.user.id,
          name: socket.user.name,
          avatarUrl: socket.user.avatarUrl
        }
      });
      
      // Broadcast user online status to connected users
      io.emit('user_status_change', {
        userId: socket.userId,
        status: 'online'
      });
      
      // Join a personal room for direct messages
      socket.join(socket.userId);
      
      // Handle private messages
      socket.on("private_message", async (data) => {
        try {
          const { receiverId, content } = data;
          
          if (!receiverId || !content) {
            return socket.emit("error", { message: "Invalid message data" });
          }
          
          // Find or create conversation
          let conversation = await Conversation.findOne({
            where: {
              $or: [
                { user1Id: socket.userId, user2Id: receiverId },
                { user1Id: receiverId, user2Id: socket.userId }
              ]
            }
          });
          
          if (!conversation) {
            conversation = await Conversation.create({
              user1Id: socket.userId,
              user2Id: receiverId,
              lastMessageContent: content,
              lastMessageTime: new Date(),
              user1UnreadCount: 0,
              user2UnreadCount: 1
            });
          } else {
            // Update conversation with last message
            conversation.lastMessageContent = content;
            conversation.lastMessageTime = new Date();
            
            // Increment unread count for receiver
            if (conversation.user1Id === receiverId) {
              conversation.user1UnreadCount += 1;
            } else {
              conversation.user2UnreadCount += 1;
            }
            
            await conversation.save();
          }
          
          // Create message
          const message = await Message.create({
            senderId: socket.userId,
            receiverId,
            content,
            conversationId: conversation.id
          });
          
          // Create message object with all necessary data
          const messageData = {
            id: message.id,
            content: message.content,
            senderId: message.senderId,
            receiverId: message.receiverId,
            conversationId: conversation.id,
            createdAt: message.createdAt,
            read: false,
            sender: {
              id: socket.user.id,
              name: socket.user.name,
              avatarUrl: socket.user.avatarUrl
            }
          };
          
          console.log(`Preparing to emit message from ${socket.userId} to ${receiverId}`);
          
          // More reliable message delivery - emit to all connected clients
          // and let the frontend filter messages
          console.log(`Broadcasting message to all sockets (${io.sockets.sockets.size} connected)`);
          
          // Broadcast to everyone
          io.emit("private_message", {
            message: messageData
          });
          
          // Emit back to sender for confirmation
          console.log('Emitting message_sent confirmation');
          socket.emit("message_sent", {
            message: messageData
          });
          
          // Log the message for debugging
          console.log(`Message sent from ${socket.userId} to ${receiverId}:`, messageData);
          
          // Emit unread count update to receiver
          const receiverSocket = Array.from(io.sockets.sockets.values())
            .find(s => s.userId === receiverId);
            
          if (receiverSocket) {
            // Get total unread count for receiver
            const convos = await Conversation.findAll({
              where: {
                [Op.or]: [
                  { user1Id: receiverId },
                  { user2Id: receiverId }
                ]
              }
            });
            
            let totalUnread = 0;
            for (const conv of convos) {
              if (conv.user1Id === receiverId) {
                totalUnread += conv.user1UnreadCount || 0;
              } else {
                totalUnread += conv.user2UnreadCount || 0;
              }
            }
            
            console.log(`Emitting unread count update (${totalUnread}) to ${receiverId}`);
            receiverSocket.emit('unread_count_update', { count: totalUnread });
          }
        } catch (error) {
          console.error("Message error:", error);
          socket.emit("error", { message: "Failed to send message" });
        }
      });
      
      // Mark messages as read
      socket.on("mark_read", async (data) => {
        try {
          const { conversationId } = data;
          
          const conversation = await Conversation.findByPk(conversationId);
          if (!conversation) {
            return socket.emit("error", { message: "Conversation not found" });
          }
          
          // Store the previous unread count before resetting
          let markedCount = 0;
          if (conversation.user1Id === socket.userId) {
            markedCount = conversation.user1UnreadCount || 0;
            conversation.user1UnreadCount = 0;
          } else if (conversation.user2Id === socket.userId) {
            markedCount = conversation.user2UnreadCount || 0;
            conversation.user2UnreadCount = 0;
          }
          
          await conversation.save();
          
          // Mark messages as read
          await Message.update(
            { read: true },
            {
              where: {
                conversationId,
                receiverId: socket.userId,
                read: false
              }
            }
          );
          
          // Send the count of marked messages back to the client
          socket.emit("messages_marked_read", {
            conversationId,
            markedCount
          });
        } catch (error) {
          console.error("Mark read error:", error);
          socket.emit("error", { message: "Failed to mark messages as read" });
        }
      });
      
      // Get online connected users
      socket.on("get_online_connections", async () => {
        try {
          // Get user's connections
          const connections = await Connection.findAll({
            where: {
              [Op.or]: [
                { userOneId: socket.userId },
                { userTwoId: socket.userId }
              ]
            }
          });
          
          // Extract connected user IDs
          const connectedUserIds = connections.map(conn =>
            conn.userOneId === socket.userId ? conn.userTwoId : conn.userOneId
          );
          
          // Filter online users who are connected to this user
          const onlineConnections = Array.from(onlineUsers.values())
            .filter(user => connectedUserIds.includes(user.userId));
          
          // Send the list to the requesting user
          socket.emit('online_connections', onlineConnections);
        } catch (error) {
          console.error("Error getting online connections:", error);
          socket.emit("error", { message: "Failed to get online connections" });
        }
      });
      
      // Handle disconnection
      socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.userId}`);
        
        // Remove user from online users map
        onlineUsers.delete(socket.userId);
        
        // Broadcast user offline status
        io.emit('user_status_change', {
          userId: socket.userId,
          status: 'offline'
        });
      });
    });

    server.listen(PORT, () =>
      console.log(`🚀 Server running at http://localhost:${PORT}`)
    );

  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
})();