import { Router, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Snowflake } from "@theinternetfolks/snowflake";
import { db } from "../utils/db.server";

const router = Router();

// Define the request body schema
const signUpSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

//Define the request body schema
const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Sign up endpoint
router.post("/signup", async (req: Request, res: Response) => {
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
            param: "email",
            message: "User with this email address already exists.",
            code: "RESOURCE_EXISTS",
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
        code: "INVALID_INPUT",
      }));

      return res.status(400).json({
        status: false,
        errors,
      });
    }

    // Return a generic error response for any other errors
    return res.status(500).json({
      status: false,
      errors: [
        { message: "Internal Server Error", code: "INTERNAL_SERVER_ERROR" },
      ],
    });
  }
});

// Generate access token using JWT
function generateAccessToken(userId: string): string {
  const secretKey = process.env.JWT_SECRET as string; // Replace with your own secret key
  const tokenPayload = { userId };
  const options = { expiresIn: "1h" }; // Token expires in 1 hour

  return jwt.sign(tokenPayload, secretKey, options);
}

// Sign in endpoint
router.post("/signin", async (req: Request, res: Response) => {
  try {
    // Validate the request body against the schema
    const validatedData = signInSchema.parse(req.body);

    // Retrieve the user from the database by email
    const user = await db.user.findUnique({
      where: { email: validatedData.email },
    });

    // Check if the user exists and verify the password
    if (!user || !bcrypt.compareSync(validatedData.password, user.password)) {
      return res.status(401).json({
        status: false,
        errors: [
          {
            param: "password",
            message: "The credentials you provided are invalid.",
            code: "INVALID_CREDENTIALS",
          },
        ],
      });
    }

    // Generate access token
    const accessToken = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET as string,
      {
        expiresIn: "1h",
      }
    );

    // Remove the password field from the user object
    const { password, ...userData } = user;

    // Return the success response with access token
    res.status(200).json({
      status: true,
      content: {
        data: userData,
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
        code: "INVALID_INPUT",
      }));

      return res.status(400).json({
        status: false,
        errors,
      });
    }

    // Return a generic error response for any other errors
    return res.status(500).json({
      status: false,
      errors: [
        { message: "Internal Server Error", code: "INTERNAL_SERVER_ERROR" },
      ],
    });
  }
});

// Get Me endpoint
router.get("/me", async (req: Request, res: Response) => {
  try {
    // Check if the access token is present
    const accessToken = req.headers.authorization?.split(" ")[1];

    if (!accessToken) {
      return res.status(401).json({
        status: false,
        errors: [
          { message: "You need to sign in to proceed.", code: "NOT_SIGNEDIN" },
        ],
      });
    }

    // Get the user ID from the access token
    const userId = getUserIdFromAccessToken(accessToken);

    if (!userId) {
      return res.status(401).json({
        status: false,
        errors: [{ message: "Invalid access token", code: "INVALID_TOKEN" }],
      });
    }

    // Retrieve the user details from the database
    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        created_at: true,
      },
    });

    // Check if the user exists
    if (!user) {
      return res.status(404).json({
        status: false,
        errors: [{ message: "User not found", code: "USER_NOT_FOUND" }],
      });
    }

    // Return the user details
    return res.status(200).json({
      status: true,
      content: {
        data: user,
      },
    });
  } catch (error) {
    console.error("Error in Get Me:", error);
    return res.status(500).json({
      status: false,
      errors: [
        { message: "Internal Server Error", code: "INTERNAL_SERVER_ERROR" },
      ],
    });
  }
});

// Function to extract user ID from the access token
function getUserIdFromAccessToken(accessToken: string): string | null {
  try {
    const decodedToken: any = jwt.verify(
      accessToken,
      process.env.JWT_SECRET as string
    );
    return decodedToken.id;
  } catch (error) {
    return null;
  }
}

export default router;
