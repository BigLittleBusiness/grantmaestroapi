# Grant Maestro API

The backend API for Grant Maestro, built with Node.js, Express, and Sequelize (MySQL).

## Prerequisites

- Node.js 22.x
- MySQL 8.0+
- AWS Account (S3 for file storage, SES for email)

## Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/BigLittleBusiness/grantmaestroapi.git
   cd grantmaestroapi
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Copy the example environment file and fill in your local details:
   ```bash
   cp config/config.env.example config/config.env
   ```
   *Note: Ensure your local MySQL server is running and the database specified in `DB_NAME` exists.*

4. **Database Setup**
   The application uses Sequelize ORM. On first boot, it will automatically sync the schema (`sync({ alter: true })`).

5. **Start the server**
   ```bash
   # Development mode (with nodemon)
   npm run dev

   # Production mode
   npm start
   ```

## Tech Stack

- **Framework:** Express.js
- **Database:** MySQL (via Sequelize ORM)
- **Authentication:** JWT (JSON Web Tokens) + HTTP-only cookies
- **File Storage:** Amazon S3 (`multer-s3`)
- **Email:** Amazon SES (`nodemailer` + `@aws-sdk/client-ses`)
- **Payments:** Pin Payments REST API

## API Documentation

Swagger UI documentation is available when the server is running at:
`http://localhost:3000/api-docs`

## Deployment (AWS EC2)

This repository includes a GitHub Actions workflow (`.github/workflows/aws.yml`) that automatically deploys the `main` branch to an EC2 instance.

**Required GitHub Secrets:**
- `EC2_HOST`: The Elastic IP of the EC2 instance
- `EC2_USERNAME`: Usually `ubuntu`
- `EC2_SSH_KEY`: The private SSH key for the instance

**Server Requirements:**
- Node.js 22 and PM2 installed
- Nginx configured as a reverse proxy
- `/var/www/grantmaestroapi` directory owned by the deployment user
- `config/config.env` populated with production values
