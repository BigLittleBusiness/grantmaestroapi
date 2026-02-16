import asyncHandler from '../middlewares/async.js'
import base from '../models/base.js'

const { GrantCategory } = base

/**
 * Fetches the list of grant categories that are not marked as deleted.
 * The categories are sorted by their names in ascending order.
 *
 * @async
 * @function getGrantCategoryList
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 * @returns {Promise<void>} Sends a response containing the list of grant categories.
 * @throws {Error} Passes any errors to the next middleware.
 */
export const getGrantCategoryList = asyncHandler(async (req, res, next) => {
  try {
    const grantCategoryList = await GrantCategory.findAll({
      where: { is_deleted: false },
      attributes: ['grant_category_id', 'grant_category_name'], // Explicitly specify attributes to fetch
      order: [['grant_category_name', 'asc']], // Sorting by grant_category_name in ascending order
    })

    if (!grantCategoryList || grantCategoryList.length === 0) {
      return res.status(404).send({
        status: false,
        message: 'No grant categories found.',
        data: {},
      })
    }

    const grantCategory = grantCategoryList.map((el) => ({
      grant_category_id: el.grant_category_id,
      grant_category_name: el.grant_category_name,
    }))

    res.status(200).send({
      status: true,
      message: 'Grant category list fetched successfully.',
      data: { grantCategory },
    })
  } catch (error) {
    console.error('Error fetching grant categories:', error)
    next(error) // Pass the error to the error-handling middleware
  }
})

/**
 * Manages the creation and updating of grant categories.
 *
 * This function handles the addition of a new grant category or updates an existing one
 * based on the provided category ID. It ensures that the category name is unique and not
 * marked as deleted before proceeding with the operation.
 *
 * @async
 * @function manageCategory
 * @param {Object} req - The request object.
 * @param {Object} req.body - The body of the request.
 * @param {number} [req.body.category_id] - The ID of the category to update (optional).
 * @param {string} req.body.category_name - The name of the category to create or update.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 * @returns {Promise<void>} Sends a response indicating the success or failure of the operation.
 *
 * @throws {Error} Throws an error if the database operation fails.
 */
export const manageCategory = asyncHandler(async (req, res, next) => {
  const { category_id, category_name } = req.body
  const check = await GrantCategory.findOne({
    where: { grant_category_name: category_name, is_deleted: 0 },
  })
  if (check) {
    return res.send({
      status: false,
      message: 'Grant category name already exist',
      data: {},
    })
  }
  const catgObj = {
    grant_category_name: category_name,
  }
  if (category_id) {
    await GrantCategory.update(
      { catgObj },
      {
        where: { grant_category_id: category_id },
      }
    )
  } else {
    await GrantCategory.create(catgObj)
  }

  res.send({
    status: true,
    message: 'Grant category added successfully',
    data: {},
  })
})
