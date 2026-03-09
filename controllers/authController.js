const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')

// Director account details.
const director = {
  name: 'Orban',
  email: 'orban@karibu.com',
  password: 'Orban@123',
  phone: '0700000000',
  role: 'Director',
  branch: 'Matugga'
}

let ensureDirectorPromise
// Make sure the fixed Director account exists before auth actions.
async function ensureDirector() {
  if (ensureDirectorPromise) return ensureDirectorPromise

  ensureDirectorPromise = (async () => {
    const hashedPassword = await bcrypt.hash(director.password, 10)
    await User.findOneAndUpdate(
      { email: director.email },
      {
        $set: {
          name: director.name,
          phone: director.phone,
          role: director.role,
          branch: director.branch,
          password: hashedPassword
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
  })()

  return ensureDirectorPromise
}

// Create a new user account (not Director) and hash the password.
async function registerUser(req, res) {
  try {
    await ensureDirector()
    const { name, email, password, phone, role, branch } = req.body

    if (role === 'Director') {
      return res.status(403).json({ message: 'Director account is fixed and cannot be created.' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      role,
      branch
    })

    res.status(201).json(user)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// Get all users without sending passwords.
async function getUsers(req, res) {
  try {
    const users = await User.find().select('-password')
    res.status(200).json(users)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Check login details and return a token.
async function login(req, res) {
  try {
    await ensureDirector()
    const { email, password } = req.body

    const user = await User.findOne({ email })
    if (!user) return res.status(400).json({ message: 'User not found' })

    if (user.role === 'Director' && user.email !== director.email) {
      return res.status(403).json({ message: 'Only the official Director account is allowed.' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' })

    const token = jwt.sign(
      { id: user._id, role: user.role, branch: user.branch, tokenVersion: Number(user.tokenVersion || 0) },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    )

    res.json({ message: 'Login successful', token })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Log out the current user by invalidating old tokens.
async function logout(req, res) {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { tokenVersion: 1 }
    })
    res.status(200).json({ message: 'Logged out successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// Get the logged-in user's profile without password data.
async function getProfile(req, res) {
  try {
    const user = await User.findById(req.user.id).select('-password')

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.status(200).json(user)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

module.exports = {
  registerUser,
  getUsers,
  login,
  logout,
  getProfile
}
