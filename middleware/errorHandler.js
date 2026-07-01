const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    
    if (err.name === 'ValidationError') {
        req.flash('error_msg', Object.values(err.errors).map(e => e.message).join(', '));
        return res.redirect('back');
    }
    
    if (err.code === 11000) {
        req.flash('error_msg', 'Duplicate entry found');
        return res.redirect('back');
    }
    
    req.flash('error_msg', err.message || 'Something went wrong!');
    res.redirect('back');
};

const notFound = (req, res) => {
    res.status(404).render('error/404', { 
        title: 'Page Not Found',
        layout: 'layouts/main'
    });
};

module.exports = { errorHandler, notFound };