import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Snowflake } from '@theinternetfolks/snowflake';
import { db } from '../utils/db.server';

const router = Router();

// Define the request body schema
const signUpSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

// Sign up endpoint
router.post('/signup', async (req: Request, res: Response) => {
  try {
    // Validate the request body against the schema
    const validatedData = signUpSchema.parse(req.body);

    // Check if user with given email already exists
    const existingUser = await db.user.findFirst({
      where: {
        email: validatedData.email,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        status: false,
        errors: [
          {
            param: 'email',
            message: 'User with this email address already exists.',
            code: 'RESOURCE_EXISTS',
          },
        ],
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Create a new user
    const userId = Snowflake.generate();

    const user = await db.user.create({
      data: {
        id: userId,
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
      },
    });

    // Generate access token using JWT
    const accessToken = generateAccessToken(user.id);

    // Return the success response
    res.status(200).json({
      status: true,
      content: {
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          created_at: user.created_at,
        },
        meta: {
          access_token: accessToken,
        },
      },
    });
  } catch (error) {
    // Handle the validation error and return the error response
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => ({
        param: err.path[0],
        message: err.message,
        code: 'INVALID_INPUT',
      }));

      return res.status(400).json({
        status: false,
        errors,
      });
    }

    // Return a generic error response for any other errors
    return res.status(500).json({
      status: false,
      errors: [{ message: 'Internal Server Error', code: 'INTERNAL_SERVER_ERROR' }],
    });
  }
});

// Generate access token using JWT
function generateAccessToken(userId: string): string {
  const secretKey = '1x234'; // Replace with your own secret key
  const tokenPayload = { userId };
  const options = { expiresIn: '1h' }; // Token expires in 1 hour

  return jwt.sign(tokenPayload, secretKey, options);
}

export default router;
