const User = require('../models/User');

exports.loginForm = (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('auth/login', { title: 'Login' });
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    
    if (!user || !(await user.comparePassword(password))) {
      req.flash('error_msg', 'Invalid credentials');
      return res.redirect('/auth/login');
    }
    
    if (!user.isActive) {
      req.flash('error_msg', 'Account is deactivated');
      return res.redirect('/auth/login');
    }
    
    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      workerType: user.workerType
    };
    
    req.flash('success_msg', 'Login successful');
    res.redirect('/dashboard');
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Login failed');
    res.redirect('/auth/login');
  }
};

exports.registerForm = (req, res) => {
  res.render('auth/register', { title: 'Register' });
};

exports.register = async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;
    
    if (password !== confirmPassword) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect('/auth/register');
    }
    
    const userExists = await User.findOne({ $or: [{ username }, { email }] });
    if (userExists) {
      req.flash('error_msg', 'User already exists');
      return res.redirect('/auth/register');
    }
    
    const user = await User.create({
      username,
      email,
      password,
      role: 'admin'
    });
    
    req.flash('success_msg', 'Registration successful. Please login.');
    res.redirect('/auth/login');
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Registration failed');
    res.redirect('/auth/register');
  }
};

exports.logout = (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
};