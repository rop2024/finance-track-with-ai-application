# AI Service Module - Strict Isolation Notice

## ⚠️ CRITICAL: Database Model Isolation

This module (and all subdirectories) **MUST NOT** directly import any database models.

### Architecture Rules:

1. **NO DIRECT DATABASE ACCESS**
   - Do NOT import models from `../../models/`
   - Do NOT use Mongoose directly
   - Do NOT execute database queries

2. **Communication Protocol**
   - AI services can ONLY receive data through:
     - Controller parameters
     - Service method arguments
     - Pre-processed DTOs (Data Transfer Objects)

3. **Data Flow**e