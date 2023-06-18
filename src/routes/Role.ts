import express from 'express';
import type {Request, Response} from 'express';
import { z } from 'zod';
import { Snowflake } from '@theinternetfolks/snowflake';
import { db } from '../utils/db.server';

const router = express.Router();

// Define the request body schema
const roleSchema = z.object({
  name: z.string().min(2, { message: 'Name should be at least 2 characters.' }),
});

//Role create endpoint
router.post('/role', async (req: Request, res: Response) => {
    try {
      // Validate the request body against the schema
      const validatedData = roleSchema.safeParse(req.body);
  
      if (!validatedData.success) {
        // Handle the validation error and return the error response
        const errors = validatedData.error.issues.map((issue) => ({
          param: issue.path[0],
          message: issue.message,
          code: 'INVALID_INPUT',
        }));
  
        return res.status(400).json({
          status: false,
          errors,
        });
      }
  
      // Process the request and create the role
      const roleId = Snowflake.generate();
  
      const role = await db.role.create({
        data: {
          id: roleId,
          name: validatedData.data.name,
        },
      });
  
      // Return the success response
      res.status(200).json({
        status: true,
        content: {
          data: role,
        },
      });
    } catch (error: any) {
      // Return a generic error response for any other errors
      return res.status(500).json({
        status: false,
        errors: [{ message: 'Internal Server Error', code: 'INTERNAL_SERVER_ERROR' }],
      });
    }
  });

// Role get all endpoint
router.get('/role', async (req: Request, res: Response) => {
  try {
    // Retrieve all roles from the database
    const roles = await db.role.findMany();

    // Calculate pagination values
    const total = roles.length;
    const itemsPerPage = 10;
    const pages = Math.ceil(total / itemsPerPage);
    const page = Number(req.query.page) || 1;

    // Paginate the roles
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = page * itemsPerPage;
    const paginatedRoles = roles.slice(startIndex, endIndex);

    // Return the success response with pagination metadata
    res.status(200).json({
      status: true,
      content: {
        meta: {
          total,
          pages,
          page,
        },
        data: paginatedRoles,
      },
    });
  } catch (error) {
    // Return an error response if there's an error
    res.status(500).json({
      status: false,
      errors: [{ message: 'Internal Server Error', code: 'INTERNAL_SERVER_ERROR' }],
    });
  }
});
  

export default router;
