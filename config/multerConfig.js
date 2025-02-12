import multer from "multer";

const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {

        if (!file.originalname.match(/\.(xls|xlsx)$/)) {
            return cb(new Error("Solo se permiten archivos Excel (.xls, .xlsx)"));
        }

        cb(null, true);
    },
});

export default upload;
