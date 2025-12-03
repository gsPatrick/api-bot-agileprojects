const success = (res, data, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
    });
};

const error = (res, message = 'Internal Server Error', statusCode = 500, error = null) => {
    return res.status(statusCode).json({
        success: false,
        message,
        error: error ? error.message || error : null,
    });
};

module.exports = {
    success,
    error,
};
