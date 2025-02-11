import gulp from 'gulp';
import { deleteAsync } from 'del';

gulp.task('remove-server', async () => await deleteAsync(['build/server']));
gulp.task('remove-tests', async () => await deleteAsync(['build/core/__tests__']));

function copyAssets(assetsDir) {
  return gulp.parallel(
    () => gulp.src('./node_modules/lodash/lodash.min.js').pipe(gulp.dest(assetsDir)),
    () => gulp.src('./node_modules/inputmask/dist/inputmask.min.js').pipe(gulp.dest(assetsDir)),
    () => gulp.src('./node_modules/moment/min/moment.min.js').pipe(gulp.dest(assetsDir)),
    () => gulp.src('./node_modules/@formio/core/dist/formio.core.min.js').pipe(gulp.dest(assetsDir)),
    () => gulp.src('./node_modules/fast-json-patch/dist/fast-json-patch.min.js').pipe(gulp.dest(assetsDir)),
    () => gulp.src('./node_modules/nunjucks/browser/nunjucks.min.js').pipe(gulp.dest(assetsDir)),
    () => gulp.src('./src/core/deps/assets/*').pipe(gulp.dest(assetsDir))
  )
}

gulp.task('copy-assets-build', copyAssets('build/core/deps/assets'));
gulp.task('prebuild', async () => deleteAsync(['build']))
gulp.task('postbuild', gulp.parallel('copy-assets-build', 'remove-server'));
