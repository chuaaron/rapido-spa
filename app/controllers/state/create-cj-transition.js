import Ember from "ember";

//This may not be needed for twitter typeahead
import HasTypeAheadEditor from '../../mixins/hastypeahead';

export default Ember.ObjectController.extend(HasTypeAheadEditor, {
	needs: ['project','states'],
	projectController: Ember.computed.alias("controllers.project"),
    statesController: Ember.computed.alias('controllers.states'),
    
     initialization: function() {
         // Reset defaults when a new state is selected
        this.set('wizardState', 'start');
        this.set('collectionName', '');
        this.set('prompt', '');
        this.set('rel', '');
        this.set('url', '');

    }.observes('model.id'),

    words: function() { 
        return this.get('projectController').model.get('simpleVocabulary');
    }.property('projectController.model.simpleVocabulary'),
    stateNames: function() {
        var stateNames = [];
        stateNames.push('http://');
        stateNames.push('https://');
        stateNames.push('/');
        var states = this.get('statesController').model.get('content');
        for( var i =0; i < states.length; i++ ) {
            stateNames.push('$(' + states[i].get('name') + ')');
        }
        return stateNames;
    }.property('statesController.model'),

    wizard_start: function() { if(this.get('wizardState') === 'start') { return true; } else { return false; } }.property('wizardState'),
    wizard_createItem: function() { if(this.get('wizardState') === 'createItem') { return true; } else { return false; } }.property('wizardState'),
    wizard_createLink: function() { if(this.get('wizardState') === 'createLink') { return true; } else { return false; } }.property('wizardState'),
    wizard_defineLink: function() { if(this.get('wizardState') === 'defineLink') { return true; } else { return false; } }.property('wizardState'),
    wizard_createQuery: function() { if(this.get('wizardState') === 'createQuery') { return true; } else { return false; } }.property('wizardState'),

    wizardState: 'start',
    wizardStackPush: function() { this.get('wizardStack').push(this.get('wizardState')); console.log(this.get('wizardStack')); }.observes('wizardState'),
    wizardStack: [],

    collectionName: '',
    linkLocation: function() {
        var list = [{name: 'Collection', index: -1}];
        var items = this.get('model').get('responses').primary.collection.items;
        if( !items ) return list;

        for( var i = 0; i < items.length; i++ ) {
            list.push({name: items[i].href, index: i} );
        }
        return list;
    }.property('model'),
    linkLocationSelection: -1,
    url: '',
    isUrlValid: function() {
        var url = this.get('url');
        if( !url || url.length === 0 ) { this.set('class_url', 'has-error'); return false; }
        else { this.set('class_url', ''); return true; }
    }.observes('url'),
    class_url: 'has-error',
    rel: '',
    isRelValid: function() {
        var rel = this.get('rel');
        if( !rel || rel.length === 0 ) { this.set('class_rel', 'has-error'); return false; }
        else {  this.set('class_rel', ''); return true; }
    }.observes('rel'),
    class_rel: 'has-error',
    isLinkValid: function() {
        console.log('isLinkValid?')
            console.log(this.isRelValid());
        return (this.isRelValid() && this.isLinkValid());
    }.property('rel','url'),
    prompt: '',
    actions: {
       previous: function() {
           console.log(this.get('wizardStack'));
           this.set('wizardState', this.get('wizardStack').pop());
       },
       createItem: function() {
           this.set('wizardState', 'createItem');
       },
       createItem_finish:  function() {
           // Create a new child collection and insert a reference to this child collection
           // in the source collection's data property.
           var controller = this;

           var projectId = this.get('projectController').model.id;  
           var newItemBody = { collection:  {}, version: '1.0'};
           var newState = this.store.createRecord('state', { project: projectId, name: this.get('collectionName'), responses: {'primary': newItemBody } });
           newState.save().then(function(savedState) {
               console.log(savedState);
               var source = controller.get('model');
               var sourceCJ = source.get('responses').primary;
               var url = '$(' + savedState.get('name') + ')';
               
               // update the source node's collection json body with a new item
               if( !sourceCJ.collection.items ) { sourceCJ.collection.items = []; }
               var newItem = { href: url, data: [], links: [] };
               sourceCJ.collection.items.push(newItem);

               // update the source node's transitions so that the graph will reflect the link
               source.get('transitions').push({name: '[item]', methods: [], target: savedState.get('id'), className: 'cj-item'});
               console.log(source);
           
               // save changes to the source node
               return source.save();

               // update the graph data

               // re-route to the graph page
           }).then(function() {
               controller.transitionToRoute('states');
           });


           // update the graph
           // transition back to the parent route.
       },
       createLink: function() {
           this.set('wizardState', 'createLink');
       },
       defineLink: function() {
           this.set('wizardState', 'defineLink');
       },
       createLink_finish: function() {
           var controller = this;
           var projectId = this.get('projectController').model.id;  
           
           // add the item property to the colleciton JSON state and create a transition 
           // Declaring this as a function so I can either call it from a promise chain or directly in synchronous code
           function updateSource(transitionTarget) {

               // Update the source node's links collection in the appropriate place.
               var source = controller.get('model');
               var sourceCJ = source.get('responses').primary;

               var itemIndex = controller.get('linkLocationSelection');
               if( itemIndex < 0 ) {
                   if( !sourceCJ.links ) { sourceCJ.links = []; }
                   sourceCJ.links.push({
                       href: '$(' + transitionTarget.get('name') + ')',
                       rel: controller.get('rel'),
                       prompt: controller.get('prompt')
                   });
               }

               var transitions = source.get('transitions');
               if( !transitions ) { transitions = [] };
               transitions.push({
                           name: controller.get('rel'),
                           methods: ['GET'],
                           target: transitionTarget.get('id'),
                           className: 'cj-link',
               });
               source.set('transitions', transitions);
               // save the updated state node
               source.save();

               // redirect the user to the graph page.
               controller.transitionToRoute('states');
           }
            
           var url = this.get('url');

           if( url.indexOf('$(',0) < 0 && url.indexOf('://') < 0) { 
               // This link points to a new collection
               console.log('new item');

               // Create the new colleciton object and save it
               var newItemBody = { collection:  {}, version: '1.0'};
               var newState = this.store.createRecord('state', { project: projectId, name: url, responses: {'primary': newItemBody } });
               newState.save().then(function(savedState) {
                   console.log(savedState);
                   updateSource(savedState);
               });

           } else {
               // not creating a new item, just update.
               console.log('not new');
           }

           
       }
   }
});
