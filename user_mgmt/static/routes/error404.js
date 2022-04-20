/** Error404 route **/

export default {
    data: function(){
        return {
        }
    },
    computed: {
        'pathMatch': function() {
            return this.$route.params[0];
        }
    },
    template: `
<article class="error">
    <h2>Error: page not found</h2>
    <p><span class="code">{{ pathMatch }}</span> does not exist</p>
</article>`
}
