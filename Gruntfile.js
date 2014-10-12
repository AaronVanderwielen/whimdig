module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		watch: {
			files: ['static/css/*'],
			tasks: ['less']
		},
		less: {
			files: [
                {
                	expand: true,
                	cwd: 'static/css',
                	src: '**/*.less',
                	dest: 'static/css',
                	ext: '.css'
                }
			]
		}
	});
 
	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks('grunt-contrib-watch');
};