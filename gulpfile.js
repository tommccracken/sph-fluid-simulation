const gulp = require('gulp');
const markdown = require('gulp-markdown');
const fs = require('fs');

const replace = require('gulp-replace');

gulp.task('copy-files', function (done) {
    gulp.src('./src/lib/sph-library.js')
        .pipe(gulp.dest('./docs/'));

    gulp.src('./src/demo/index.html')
        .pipe(gulp.dest('./docs/'));

    gulp.src('./src/demo/sph-demo-scenes.js')
        .pipe(gulp.dest('./docs/'));

    gulp.src('./src/demo/sph-demo.js')
        .pipe(gulp.dest('./docs/'));

    gulp.src('README.md')
        .pipe(markdown())
        .pipe(gulp.dest('docs'));

    done();
});

gulp.task('prepare-HTML', function (done) {

    gulp.src('README.md')
        .pipe(markdown())
        .pipe(gulp.dest('docs'));

    done();
});

gulp.task('inject-HTML', function (done) {
    gulp.src('./src/demo/index.html')
        .pipe(replace('<!-- HTML INJECTION SITE -->', fs.readFileSync('./docs/README.html', 'utf8')))
        .pipe(gulp.dest('./docs'));
    done();
});

gulp.task('clean', function (done) {
    fs.unlinkSync('./docs/README.html');
    done();
});
