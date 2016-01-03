'use strict';

module.exports = function (grunt) {
  grunt.loadNpmTasks('grunt-typescript');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.initConfig({

    pkg: grunt.file.readJSON('package.json'),

    typescript: {
      base: {
        src: ['src/**/*.ts'],
        dest: 'lib',
        options: {
          module: 'commonjs',
          target: 'es5',
          sourceMap: true,
          declaration: true,
          references: [
            'typings/**/*.d.ts'
          ],
          noImplicitAny: true
        }
      }
    },

    watch: {
      files: 'src/**/*.ts',
      tasks: ['typescript']
    }

  });

  grunt.registerTask('default', ['watch']);
};
