# Amor Fly Backend

A skill-based community platform backend that creates anonymous learning pods and facilitates 1:1 connections through engagement.

## Features Implemented

### Core Backend Features ✅
- **User Authentication**: Registration, login with JWT tokens
- **Intelligent Pod Formation**: Algorithm that groups users based on skills and personality compatibility
- **Anonymous Identity Management**: Users get anonymous names in pods
- **Real-time Chat**: Socket.io integration for pod messaging
- **Engagement Tracking**: Points system based on participation
- **1:1 Connection System**: Weekly limited connections with eligibility requirements
- **Content Filtering**: Basic profanity filtering for messages

### API Endpoints

#### Authentication (`/api/auth/`)
- `POST /register` - Create new user account
- `POST /login` - User login
- `GET /me` - Get current user profile

#### Skills (`/api/skills/`)
- `GET /` - Get all available skills
- `GET /categories` - Get skills organized by category
- `GET /search?q=term` - Search skills

#### Pods (`/api/pods/`)
- `POST /join` - Join or create a pod (intelligent matching)
- `GET /my-pod` - Get current user's pod
- `GET /:podId/messages` - Get pod chat history
- `POST /:podId/messages` - Send message to pod
- `POST /:podId/messages/:messageId/react` - React to message
- `POST /leave` - Leave current pod

#### Connections (`/api/connections/`)
- `GET /discover` - Find potential 1:1 connections
- `POST /request` - Send connection request
- `POST /:connectionId/respond` - Accept/reject connection
- `GET /my-connections` - Get user's connections
- `POST /:connectionId/feedback` - Submit connection feedback
- `GET /eligibility` - Check connection eligibility

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env` and update values:
```bash
cp .env.example .env
```

### 3. Database Setup
- Install MongoDB locally OR use MongoDB Atlas
- Update `MONGODB_URI` in `.env` file

### 4. Run the Server
```bash
# Development with auto-restart
npm run dev

# Production
npm start
```

The server will start on http://localhost:5000

## Project Structure

```
├── server.js           # Main server file
├── models/
│   ├── User.js         # User schema
│   ├── Pod.js          # Pod schema
│   ├── Message.js      # Message schema
│   └── Connection.js   # 1:1 Connection schema
└── routes/
    ├── auth.js         # Authentication routes
    ├── skills.js       # Skills management
    ├── pods.js         # Pod formation & chat
    └── connections.js  # 1:1 connections
```

## Key Algorithms

### Pod Formation Algorithm
1. Checks for existing compatible pods
2. Scores pods based on personality compatibility:
   - Learning style (40% weight)
   - Motivation (35% weight)  
   - Time commitment (25% weight)
3. Joins best match (score > 0.6) or creates new pod

### Connection Eligibility
Users must meet minimum engagement to unlock 1:1 connections:
- 5+ messages in pod
- 1+ resource shared
- 10+ progress points

### Weekly Limits
- Only 1 connection per week per user
- 7-day evaluation period for each connection

## Testing the API

### 1. Register a User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "selectedSkills": ["Guitar", "Programming"],
    "personality": {
      "learningStyle": "visual",
      "motivation": "collaborative", 
      "timeCommitment": "regular"
    }
  }'
```

### 2. Join a Pod
```bash
curl -X POST http://localhost:5000/api/pods/join \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Send a Message
```bash
curl -X POST http://localhost:5000/api/pods/POD_ID/messages \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello fellow learners!",
    "type": "text"
  }'
```

## Next Steps for Full Implementation

1. **Frontend Integration**: Build React/React Native frontend
2. **File Upload**: Add Cloudinary integration for images
3. **Push Notifications**: Real-time notifications
4. **Advanced Analytics**: Learning progress tracking
5. **Admin Panel**: Pod and user management
6. **Testing**: Unit and integration tests

## Database Schema

The app uses MongoDB with 4 main collections:
- **Users**: Authentication, skills, personality, engagement metrics
- **Pods**: Skill-based groups with max 6 members
- **Messages**: Pod chat with reactions and resource sharing
- **Connections**: 1:1 connections with evaluation periods

This backend provides a solid foundation for the Amor Fly platform with all core features implemented!
