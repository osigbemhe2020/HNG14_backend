# HNG14_backend
# Gender Classifier API

A lightweight REST API that integrates with the [Genderize.io](https://genderize.io) API to classify names by gender and return a structured, enriched response.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Server](#running-the-server)
- [API Reference](#api-reference)
  - [GET /api/classify](#get-apiclassify)
  - [Success Response](#success-response)
  - [Error Responses](#error-responses)
- [Processing Rules](#processing-rules)
- [Edge Cases](#edge-cases)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Testing](#testing)

---

## Overview

This API exposes a single `GET` endpoint that accepts a name as a query parameter, calls the external Genderize.io API, processes the raw response, and returns a clean structured result including:

- The predicted gender
- The probability of that prediction
- The sample size used for prediction
- A computed confidence flag (`is_confident`)
- A UTC timestamp of when the request was processed

---

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **HTTP Client**: Axios
- **CORS**: cors middleware

---

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
node stage0.js
```
or
```bash
npm start
```

The server will start on `http://localhost:3000`.


## API Reference

### GET /api/classify

Classifies a name by gender using the Genderize.io API.

**Endpoint:**

```
GET /api/classify?name={name}
```

**Query Parameters:**

| Parameter | Type   | Required | Description                        |
|-----------|--------|----------|------------------------------------|
| `name`    | string | Yes      | The name to classify (e.g., `john`) |

---

### Success Response

**Status: `200 OK`**

```json
{
  "status": "success",
  "data": {
    "name": "john",
    "gender": "male",
    "probability": 0.99,
    "sample_size": 1234,
    "is_confident": true,
    "processed_at": "2026-04-12T10:30:00.000Z"
  }
}
```

**Response Fields:**

| Field          | Type    | Description                                                               |
|----------------|---------|---------------------------------------------------------------------------|
| `name`         | string  | The name as returned by Genderize.io                                      |
| `gender`       | string  | Predicted gender: `"male"` or `"female"`                                  |
| `probability`  | number  | Prediction confidence from Genderize.io (0.00 – 1.00)                    |
| `sample_size`  | number  | Number of records Genderize.io used for this prediction                   |
| `is_confident` | boolean | `true` if `probability >= 0.7` AND `sample_size >= 100`, otherwise `false`|
| `processed_at` | string  | UTC timestamp of when this request was processed (ISO 8601)               |

---

### Error Responses

All errors follow this structure:

```json
{
  "status": "error",
  "message": "<description of the error>"
}
```

| Status Code | Scenario                                      | Example Message                                      |
|-------------|-----------------------------------------------|------------------------------------------------------|
| `400`       | `name` parameter is missing                   | `"Missing name parameter"`                           |
| `400`       | `name` parameter is an empty string           | `"Empty name parameter"`                             |
| `422`       | `name` is not a string                        | `"Name must be a string"`                            |
| `200`       | Genderize.io has no data for the name         | `"No prediction available for the provided name"`    |
| `500`       | Internal server error or upstream API failure | `"Internal server error"`                            |

> **Note:** When Genderize.io returns `gender: null` or `count: 0`, the API responds with HTTP `200` and `status: "error"` in the body, as per the task specification.

---

## Processing Rules

The raw Genderize.io response is transformed before being returned:

1. **Field rename:** `count` from Genderize.io is renamed to `sample_size` in the response.
2. **Confidence flag:** `is_confident` is computed as:
   ```
   is_confident = (probability >= 0.7) AND (sample_size >= 100)
   ```
   Both conditions must be true. If either fails, `is_confident` is `false`.
3. **Timestamp:** `processed_at` is generated fresh on every request as a UTC ISO 8601 string using `new Date().toISOString()`. It is never hardcoded.

---

## Edge Cases

| Scenario                                 | Behaviour                                                                 |
|------------------------------------------|---------------------------------------------------------------------------|
| `name` not provided                      | Returns `400` with `"Missing name parameter"`                             |
| `name` is an empty or whitespace string  | Returns `400` with `"Empty name parameter"`                               |
| Genderize.io returns `gender: null`      | Returns `200` with `status: "error"` and a descriptive message            |
| Genderize.io returns `count: 0`          | Returns `200` with `status: "error"` and a descriptive message            |
| Genderize.io is unreachable              | Caught by try/catch, returns `500`                                        |
| Unexpected server error                  | Global error middleware catches it and returns `500`                      |

---

## Project Structure

```
├── stage0.js        # Main application — Express server and /api/classify route
├── package.json     # Project metadata and dependencies
└── README.md        # This file
```

---


## Deployment

This API can be deployed to any Node.js-compatible platform. **Render is not accepted** by the grading system. Recommended platforms:
- [Railway](https://railway.app)


Make sure your deployed URL is publicly accessible and that the `Access-Control-Allow-Origin: *` CORS header is returned on all responses (already configured in this project).

**Verify your deployment:**

```bash
curl "https://your-deployed-url.com/api/classify?name=john"
```

Expected output:

```json
{
  "status": "success",
  "data": {
    "name": "john",
    "gender": "male",
    "probability": 0.99,
    "sample_size": 1234,
    "is_confident": true,
    "processed_at": "2026-04-12T10:30:00.000Z"
  }
}
```

---

## Testing

Test the endpoint locally with `curl`:

```bash
# Successful classification
curl "http://localhost:3000/api/classify?name=john"

# Missing parameter
curl "http://localhost:3000/api/classify"

# Empty name
curl "http://localhost:3000/api/classify?name="

# Name with no Genderize.io data
curl "http://localhost:3000/api/classify?name=zzzzxxx"
```

