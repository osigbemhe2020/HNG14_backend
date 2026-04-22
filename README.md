# 📦 Profile Data API

A backend service that generates and stores user profile insights (gender, age, nationality) based on a given name using multiple external APIs.

## 🚀 Features

- 🔗 Integrates with:
  - Genderize API (gender prediction)
  - Agify API (age prediction)
  - Nationalize API (nationality prediction)
- 🧠 Applies classification logic:
  - Age grouping (child, teenager, adult, senior)
  - Selects most probable country
- 💾 Stores data in MongoDB
- 🔁 Prevents duplicate profiles (idempotent)
- 🔍 Supports filtering via query parameters
- ❌ Handles API failures gracefully

## 🛠️ Tech Stack

- Node.js
- Express.js
- MongoDB (Mongoose)
- Axios
- UUID v7

## Getting Started

### Prerequisites

- Node.js v16 or higher
- npm v7 or higher

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
npm install
```

### Running the Server

**Development:**

```bash
node server.js
```
or
```bash
npm start
```

The server will start on `http://localhost:3000`.

## 📡 Base URL
https://site--hng14-backend--nlrjqkv9zhwn.code.run/

## 📌 API Endpoints

### 1️⃣ Create Profile

**POST** `/api/profiles`

**Request Body:**
```json
{
  "name": "ella"
}
**Response (201 Created):**
{
  "status": "success",
  "data": {
    "id": "uuid-v7",
    "name": "ella",
    "gender": "female",
    "gender_probability": 0.99,
    "sample_size": 1234,
    "age": 46,
    "age_group": "adult",
    "country_id": "US",
    "country_probability": 0.85,
    "created_at": "2026-04-01T12:00:00Z"
  }
}

### Get Single Profile
GET /api/profiles/:id

Response (200 OK):

{
  "status": "success",
  "data": { ...profile }
}

### Get All Profiles
GET /api/profiles

Query Parameters (optional):

gender - Filter by gender (male/female)

country_id - Filter by country code (e.g., US, NG)

age_group - Filter by age group (child/teenager/adult/senior)


Example:
text
GET /api/profiles?gender=male&country_id=NG
Response (200 OK):

json
{
  "status": "success",
  "count": 2,
  "data": [ ...profiles ]
}

### Delete Profile
DELETE /api/profiles/:id

Response: 204 No Content

### Project Structure

├── config/
│   └── db.js
├── controllers/
│   └── stage1.controller.js
├── middlewares/
│   └── validateName.js
├── models/
│   └── profile.model.js
├── routes/
│   └── stage1.route.js
├── services/
│   └── profile.service.js
├── app.js
├── server.js
└── .env
